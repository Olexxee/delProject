import ChatRoom from "../../models/chatRoomSchema.js";
import { Message } from "../../models/messageSchema.js";
import { ensureChatAccess } from "./chatGuard.js";
import { encrypt, decrypt } from "../../lib/encryption.js";
import {
  NotFoundException,
  ForbiddenError,
  BadRequestError,
} from "../../lib/classes/errorClasses.js";
import { canSoftDelete, canDeleteForEveryone } from "./messageStateMachine.js";

// Import the instance (Singleton)
import notificationService from "../notifications/notificationService.js";
import { getSocketsByUserId } from "../socket/socketRegistry.js";

export class ChatService {
  /**
   * FETCH MESSAGES
   */
  async getMessages({ chatRoomId, userId, limit = 50, skip = 0 }) {
    const room = await ChatRoom.findById(chatRoomId).select("+aesKey");
    if (!room) throw new NotFoundException("Chat room not found");

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

    return messages.map((msg) => this._transformMessage(msg, room.aesKey));
  }

  /**
   * CREATE MESSAGE
   */
  async createMessage({
    chatRoomId,
    senderId,
    content,
    mediaIds = [],
    broadcaster = null,
  }) {
    // 1. Validation
    if (!content?.trim() && (!mediaIds || mediaIds.length === 0)) {
      throw new BadRequestError("Message must have content or media");
    }

    const room = await ChatRoom.findById(chatRoomId).select("+aesKey participants name");
    if (!room) throw new NotFoundException("Chat room not found");

    await ensureChatAccess(senderId, chatRoomId);

    // 2. Encryption (Storage level)
    const encryptedPayload = content?.trim()
      ? encrypt(content.trim(), room.aesKey)
      : null;

    // 3. Persistence
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

    await ChatRoom.updateOne({ _id: chatRoomId }, { lastMessageAt: new Date() });

    const populated = await message.populate("sender", "username firstName lastName profilePicture");

    // 4. Socket Broadcasting
    if (broadcaster) {
      broadcaster.broadcastMessage(chatRoomId, populated);
    }

    // 5. Offline Notifications
    this._handleOfflineNotifications(room, senderId, chatRoomId);

    return populated;
  }

  /**
   * PRIVATE: Handle Push Notifications
   */
  async _handleOfflineNotifications(room, senderId, chatRoomId) {
    try {
      const otherParticipants = room.participants
        .map((p) => p.toString())
        .filter((id) => id !== senderId.toString());

      // Filter users who have no active sockets
      const offlineUsers = otherParticipants.filter(
        (userId) => getSocketsByUserId(userId).length === 0
      );

      if (offlineUsers.length > 0) {
        await Promise.all(
          offlineUsers.map((userId) =>
            notificationService.send({ // Called directly on the imported instance
              recipientId: userId,
              senderId: senderId,
              type: "CHAT_MESSAGE",
              title: room.name || "New Message",
              message: "🔒 You have a new encrypted message",
              payload: { chatRoomId },
            })
          )
        );
      }
    } catch (err) {
      console.error("[Notification Error]", err);
    }
  }

  // ... updateMessageStatus and deleteMessage methods remain the same ...

  _transformMessage(msg, aesKey) {
    let content = null;
    const obj = msg.toObject();

    if (msg.encryptedContent && msg.iv && msg.authTag) {
      try {
        content = decrypt(msg.encryptedContent, aesKey, msg.iv, msg.authTag);
      } catch (err) {
        content = "[Decryption Error]";
      }
    }

    return {
      ...obj,
      content: content || obj.content,
      encryptedContent: undefined,
      iv: undefined,
      authTag: undefined,
    };
  }
}

export default new ChatService();