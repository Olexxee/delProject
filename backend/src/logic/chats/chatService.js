import ChatRoom from "../../models/chatRoomSchema.js";
import { Message } from "../../models/messageSchema.js";
import { ensureChatAccess } from "./chatGuard.js";
import { encrypt } from "../../lib/encryption.js";
import {
  NotFoundException,
  BadRequestError,
} from "../../lib/classes/errorClasses.js";

import notificationService from "../notifications/notificationService.js";
import { getSocketsByUserId } from "../socket/socketRegistry.js";

class ChatService {
  /**
   * =========================
   * FETCH MESSAGES (ENCRYPTED)
   * =========================
   */
  async getMessages({ chatRoomId, userId, limit = 50, skip = 0 }) {
    const room = await ChatRoom.findById(chatRoomId);
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

    // IMPORTANT:
    // No decryption here. Messages are returned exactly as stored.
    return messages;
  }

  /**
   * =========================
   * CREATE MESSAGE (ENCRYPT)
   * =========================
   */
  async createMessage({
    chatRoomId,
    senderId,
    content,
    mediaIds = [],
    broadcaster = null,
  }) {
    if (!content?.trim() && mediaIds.length === 0) {
      throw new BadRequestError("Message must have content or media");
    }

    const room = await ChatRoom.findById(chatRoomId)
      .select("+aesKey participants name");
    if (!room) throw new NotFoundException("Chat room not found");

    await ensureChatAccess(senderId, chatRoomId);

    // Encrypt at rest (server never decrypts)
    const encrypted = content?.trim()
      ? encrypt(content.trim(), room.aesKey)
      : null;

    const message = await Message.create({
      chatRoom: chatRoomId,
      sender: senderId,
      encryptedContent: encrypted?.cipherText ?? null,
      iv: encrypted?.iv ?? null,
      authTag: encrypted?.authTag ?? null,
      media: mediaIds,
      deliveredTo: [senderId],
      readBy: [senderId],
    });

    await ChatRoom.updateOne(
      { _id: chatRoomId },
      { lastMessageAt: new Date() }
    );

    const populatedMessage = await message.populate(
      "sender",
      "username firstName lastName profilePicture"
    );

    // Broadcast encrypted payload only
    if (broadcaster) {
      broadcaster.broadcastMessage(chatRoomId, populatedMessage);
    }

    // Notify offline participants
    await this.#notifyOfflineParticipants(
      room,
      senderId,
      chatRoomId
    );

    return populatedMessage;
  }

  /**
   * =========================
   * OFFLINE NOTIFICATIONS
   * =========================
   */
  async #notifyOfflineParticipants(room, senderId, chatRoomId) {
    try {
      const offlineUsers = room.participants
        .map(String)
        .filter(
          (id) =>
            id !== senderId.toString() &&
            getSocketsByUserId(id).length === 0
        );

      if (!offlineUsers.length) return;

      await Promise.all(
        offlineUsers.map((userId) =>
          notificationService.send({
            recipientId: userId,
            senderId,
            type: "CHAT_MESSAGE",
            title: room.name || "New Message",
            message: "🔒 You have a new encrypted message",
            payload: { chatRoomId },
          })
        )
      );
    } catch (err) {
      console.error("[ChatService Notification Error]", err);
    }
  }

  async getAesKey({ chatRoomId, userId }) {
    const room = await ChatRoom.findById(chatRoomId).select("+aesKey participants");
    if (!room) throw new NotFoundException("Chat room not found");

    // Access guard
    await ensureChatAccess(userId, chatRoomId);

    return { aesKey: room.aesKey };
  }
}

export default new ChatService();
