import * as chatRoomService from "./chatRoomService.js";
import {Message} from "../../models/messageSchema.js";
import { ensureChatAccess } from "./chatGuard.js";
import { processUploadedMedia } from "../../middlewares/processUploadedImages.js";
import { encrypt, decrypt } from "../../lib/encryption.js";
import {
  BadRequestError,
  NotFoundException,
  ForbiddenError,
} from "../../lib/classes/errorClasses.js";
import {
  canRead,
  canSoftDelete,
  canDeleteForEveryone,
} from "./messageStateMachine.js";

/**
 * Get or create a chat room based on context (e.g., 'connection', 'group', 'event')
 * Unifies logic from connectionChatService and chatService
 */
export const getOrCreateChatRoom = async ({
  contextType,
  contextId,
  userId,
}) => {
  return chatRoomService.getOrCreateChatRoom({
    contextType,
    contextId,
    userId,
  });
};

/**
 * Fetch messages with standardized pagination and access control
 */
export const getMessages = async ({
  chatRoomId,
  userId,
  limit = 50,
  skip = 0,
}) => {
  const room = await ChatRoom.findById(chatRoomId).select("+aesKey");
  if (!room) throw new Error("Chat room not found");

  await ensureChatAccess(userId, chatRoomId);

  const messages = await Message.find({
    chatRoom: chatRoomId,
    deletedFor: { $ne: userId },
    isDeleted: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "username firstName lastName profilePicture");

  return messages.map((msg) => {
    let decryptedContent = null;

    if (msg.encryptedContent && msg.iv && msg.authTag) {
      try {
        decryptedContent = decrypt(
          msg.encryptedContent,
          room.aesKey,
          msg.iv,
          msg.authTag
        );
      } catch (err) {
        decryptedContent = "[Unable to decrypt message]";
      }
    }

    return {
      ...msg.toObject(),
      content: decryptedContent,
      encryptedContent: undefined,
      iv: undefined,
      authTag: undefined,
    };
  });
};


/**
 * Unified message creation for REST, Sockets, and Media uploads
 */
export const createMessage = async ({
  chatRoomId,
  senderId,
  content,
  mediaIds = [],
  broadcaster = null,
}) => {
  if (!content?.trim() && mediaIds.length === 0) {
    throw new Error("Message must have content or media");
  }

  const room = await ChatRoom.findById(chatRoomId).select("+aesKey");
  if (!room) throw new Error("Chat room not found");

  await ensureChatAccess(senderId, chatRoomId);

  let encryptedPayload = null;

  if (content?.trim()) {
    encryptedPayload = encrypt(content.trim(), room.aesKey);
  }

  const message = await Message.create({
    chatRoom: chatRoomId,
    sender: senderId,

    encryptedContent: encryptedPayload?.cipherText || null,
    iv: encryptedPayload?.iv || null,
    authTag: encryptedPayload?.authTag || null,

    media: mediaIds,

    deliveredTo: [senderId],
    readBy: [senderId],
  });

  room.lastMessageAt = new Date();
  await room.save();

  const populated = await message.populate(
    "sender",
    "username firstName lastName profilePicture"
  );

  if (broadcaster) {
    broadcaster.broadcastMessage(chatRoomId, populated);
  }

  return populated;
};

/**
 * Mark messages as delivered
 */
export const markDelivered = async ({ chatRoomId, userId, broadcaster = null }) => {
  await ensureChatAccess(userId, chatRoomId);

  const result = await Message.updateMany(
    {
      chatRoom: chatRoomId,
      sender: { $ne: userId },
      deliveredTo: { $ne: userId },
    },
    { $addToSet: { deliveredTo: userId } }
  );

  if (broadcaster && result.modifiedCount > 0) {
    broadcaster.notifyDelivered(chatRoomId, userId);
  }

  return result;
};

/**
 * Mark messages as read
 */
export const markRead = async ({ chatRoomId, userId, broadcaster = null }) => {
  await ensureChatAccess(userId, chatRoomId);

  const result = await Message.updateMany(
    {
      chatRoom: chatRoomId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
    },
    { $addToSet: { readBy: userId, deliveredTo: userId } }
  );

  if (broadcaster && result.modifiedCount > 0) {
    broadcaster.notifyRead(chatRoomId, userId);
  }

  return result;
};

/**
 * Soft delete (remove from user's view)
 */
export const softDeleteMessage = async ({ messageId, userId }) => {
  const message = await Message.findById(messageId);
  if (!message) throw new NotFoundException("Message not found");
  
  if (!canSoftDelete(message, userId)) return message; //

  await Message.updateOne(
    { _id: messageId },
    { $addToSet: { deletedFor: userId } }
  );

  return message;
};

/**
 * Hard delete (Delete for everyone)
 */
export const deleteMessageForEveryone = async ({ user, messageId, broadcaster = null }) => {
  const message = await Message.findById(messageId);
  if (!message) throw new NotFoundException("Message not found");

  if (!canDeleteForEveryone(message, user)) {
    throw new ForbiddenError("Not authorized to delete this message"); //
  }

  await Message.updateOne(
    { _id: messageId },
    { isDeleted: true, content: "This message was deleted", media: [] }
  );

  if (broadcaster) {
    broadcaster.notifyDeletedForAll(message.chatRoom.toString(), messageId);
  }

  return message;
};