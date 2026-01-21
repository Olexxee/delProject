import * as chatService from "../../logic/chats/chatService.js";
import { ensureChatAccess } from "./chatGuard.js";
import { ChatEvents } from "../../logic/chats/chatContract.js";
import logger from "../../lib/logger.js";
import ChatBroadcaster from "../../logic/chats/chatBroadcaster.js";

/**
 * Socket-safe async wrapper with ACK support
 */

const safeHandler =
  (handler) =>
  async (payload = {}, ack) => {
    try {
      const result = await handler(payload);
      ack?.({ success: true, ...result });
    } catch (err) {
      logger.error("[Socket Chat Error]", err);
      ack?.({ success: false, error: err.message });
    }
  };

export const registerChatEvents = (io, socket) => {
  const userId = socket.user.id;
  const broadcaster = new ChatBroadcaster(io);

  /**
   * Join chat room
   */
  socket.on(
    ChatEvents.JOIN,
    safeHandler(async ({ chatRoomId, limit = 50 }) => {
      await ensureChatAccess(userId, chatRoomId);
      socket.join(chatRoomId);

      await chatService.markDelivered({ chatRoomId, userId });
      broadcaster.notifyDelivered(chatRoomId, userId);

      const messages = await chatService.getMessages({
        chatRoomId,
        userId,
        limit,
        skip: 0,
      });

      logger.info(`[Chat] User ${userId} joined room ${chatRoomId}`);
      return { messages };
    })
  );

  /**
   * Send message
   */
  socket.on(
    ChatEvents.SEND,
    safeHandler(async ({ chatRoomId, content, mediaIds = [] }) => {
      await ensureChatAccess(userId, chatRoomId);

      const message = await chatService.createMessage({
        chatRoomId,
        senderId: userId,
        content,
        files: mediaIds,
        requestContext: {},
      });

      broadcaster.broadcastMessage(chatRoomId, message);
      return { message };
    })
  );

  /**
   * Mark messages as read
   */
  socket.on(
    ChatEvents.READ,
    safeHandler(async ({ chatRoomId }) => {
      await chatService.markRead({ chatRoomId, userId });
      broadcaster.notifyRead(chatRoomId, userId);
    })
  );

  /**
   * Soft delete message
   */
  socket.on(
    ChatEvents.DELETE_SOFT,
    safeHandler(async ({ messageId }) => {
      await chatService.softDeleteMessage({ messageId, userId });
      logger.info(`[Chat] User ${userId} soft-deleted message ${messageId}`);
    })
  );

  /**
   * Hard delete message
   */
  socket.on(
    ChatEvents.DELETE_HARD,
    safeHandler(async ({ messageId }) => {
      const message = await chatService.deleteMessageForEveryone({
        user: socket.user,
        messageId,
      });
      broadcaster.notifyDeletedForAll(message.chatRoom.toString(), messageId);
      logger.info(
        `[Chat] User ${userId} deleted message ${messageId} for everyone`
      );
    })
  );

  /**
   * Typing indicator
   */
  socket.on(
    ChatEvents.USER_TYPING,
    safeHandler(async ({ chatRoomId, isTyping }) => {
      await ensureChatAccess(userId, chatRoomId);
      broadcaster.notifyTyping(chatRoomId, userId, isTyping);
    })
  );

  /**
   * Leave chat room
   */
  socket.on(ChatEvents.LEAVE, ({ chatRoomId }) => {
    socket.leave(chatRoomId);
    logger.info(`[Chat] User ${userId} left room ${chatRoomId}`);
  });

  /**
   * Disconnect
   */
  socket.on("disconnect", () => {
    logger.info(`[Chat] User ${userId} disconnected`);
  });
};
