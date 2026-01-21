import * as chatRoomService from "./chatRoomService.js";
import Message from "../../models/messageSchema.js";
import { ensureChatAccess } from "./chatGuard.js";
import { processUploadedMedia } from "../../middlewares/processUploadedImages.js";
import logger from "../../lib/logger.js";
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
 * Get or create chat room
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
 * Get messages
 */
export const getMessages = async ({
  chatRoomId,
  userId,
  limit = 50,
  skip = 0,
}) => {
  await ensureChatAccess(userId, chatRoomId);

  return Message.find({
    chatRoom: chatRoomId,
    deletedFor: { $ne: userId },
    isDeleted: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "username firstName lastName profilePicture");
};

/**
 * Create message with optional media
 */
export const createMessage = async ({
  chatRoomId,
  senderId,
  content,
  files = [],
  requestContext,
}) => {
  if (!content && files.length === 0)
    throw new BadRequestError("Message must have content or media");

  await ensureChatAccess(senderId, chatRoomId);

  let mediaIds = [];
  if (files.length > 0) {
    const mediaDocuments = await processUploadedMedia(requestContext, "chat", {
      resizeWidth: 1200,
      resizeHeight: 1200,
      quality: 85,
      minCount: 0,
    });
    mediaIds = mediaDocuments.map((doc) => doc._id);
    logger.info(
      `[Chat] User ${senderId} uploaded ${mediaIds.length} media file(s)`
    );
  }

  const message = await Message.create({
    chatRoom: chatRoomId,
    sender: senderId,
    content: content?.trim() || "",
    media: mediaIds,
    deliveredTo: [senderId],
    readBy: [senderId],
  });

  return message.populate(
    "sender",
    "username firstName lastName profilePicture"
  );
};

/**
 * Mark messages delivered
 */
export const markDelivered = async ({ chatRoomId, userId }) => {
  await ensureChatAccess(userId, chatRoomId);

  const result = await Message.updateMany(
    {
      chatRoom: chatRoomId,
      sender: { $ne: userId },
      deliveredTo: { $ne: userId },
    },
    { $addToSet: { deliveredTo: userId } }
  );

  return result;
};

/**
 * Mark messages read
 */
export const markRead = async ({ chatRoomId, userId }) => {
  await ensureChatAccess(userId, chatRoomId);

  const result = await Message.updateMany(
    {
      chatRoom: chatRoomId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
    },
    { $addToSet: { readBy: userId, deliveredTo: userId } }
  );

  return result;
};

/**
 * Soft delete message
 */
export const softDeleteMessage = async ({ messageId, userId }) => {
  const message = await Message.findById(messageId);
  if (!message) throw new NotFoundException("Message not found");
  if (!canSoftDelete(message, userId)) return message;

  await ensureChatAccess(userId, message.chatRoom);

  await Message.updateOne(
    { _id: messageId },
    { $addToSet: { deletedFor: userId } }
  );

  return message;
};

/**
 * Delete message for everyone (sender/admin)
 */
export const deleteMessageForEveryone = async ({ user, messageId }) => {
  const message = await Message.findById(messageId);
  if (!message) throw new NotFoundException("Message not found");

  if (!canDeleteForEveryone(message, user))
    throw new ForbiddenError("Not authorized");

  await ensureChatAccess(user._id.toString(), message.chatRoom);

  await Message.updateOne(
    { _id: messageId },
    { isDeleted: true, content: "This message was deleted", media: [] }
  );

  return message;
};

/**
 * Get user chat rooms
 */
export const getUserChatRooms = async ({ userId, limit = 20, skip = 0 }) => {
  const chatRooms = await chatRoomService.getUserChatRooms({
    userId,
    limit,
    skip,
  });
  return chatRooms;
};

/**
 * Fetch messages since a specific timestamp (offline sync)
 */
export const getMessagesSince = async ({
  chatRoomId,
  userId,
  since,
  limit = 50,
}) => {
  await ensureChatAccess(userId, chatRoomId);

  const query = {
    chatRoom: chatRoomId,
    deletedFor: { $ne: userId },
    isDeleted: { $ne: true },
  };

  if (since) query.createdAt = { $gt: new Date(since) };

  return Message.find(query)
    .sort({ createdAt: 1 }) // chronological
    .limit(limit)
    .populate("sender", "username firstName lastName profilePicture");
};
