import * as chatService from "../../logic/chats/chatService.js";
import { ensureChatAccess } from "./chatGuard.js";
import { ChatEvents } from "../../logic/chats/chatContract.js";
import logger from "../../lib/logger.js";
import ChatBroadcaster from "../../logic/chats/chatBroadcaster.js";

/**
 * Safe async handler with ACK support
 */
const safeHandler =
  (handler) =>
  async (payload = {}, ack) => {
    try {
      const result = await handler(payload);
      ack?.({ success: true, ...result });
    } catch (err) {
      logger.error(`[Socket Chat Error]`, err);
      ack?.({ success: false, error: err.message });
    }
  };

/**
 * Register chat-related socket events
 */
export const registerChatEvents = (io, socket) => {
  const userId = socket.user.id;
  const broadcaster = new ChatBroadcaster(io);

  // -----------------------------
  // JOIN ROOM
  // -----------------------------
  socket.on(
    ChatEvents.JOIN,
    safeHandler(async ({ chatRoomId, limit = 50 }) => {
      // Fetch room for access check
      await ensureChatAccess(userId, chatRoomId);

      socket.join(chatRoomId);

      // Mark delivered and notify
      await chatService.markDelivered({ chatRoomId, userId });
      broadcaster.notifyDelivered(chatRoomId, userId);

      // Fetch latest messages
      const messages = await chatService.getMessages({
        chatRoomId,
        userId,
        limit,
        skip: 0,
      });

      logger.info(`[Chat] User ${userId} joined room ${chatRoomId}`);
      return { messages };
    }),
  );

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------
  socket.on(
    ChatEvents.SEND,
    safeHandler(async ({ chatRoomId, content, mediaIds = [] }) => {
      await ensureChatAccess(userId, chatRoomId);

      // Create message using new ChatService API
      const message = await chatService.createMessage({
        chatRoomId,
        senderId: userId,
        content,
        mediaIds,
      });

      // Broadcast encrypted payload
      broadcaster.broadcastMessage(chatRoomId, message);

      return { message };
    }),
  );

  // -----------------------------
  // MARK AS READ
  // -----------------------------
  socket.on(
    ChatEvents.READ,
    safeHandler(async ({ chatRoomId }) => {
      await chatService.markRead({ chatRoomId, userId });
      broadcaster.notifyRead(chatRoomId, userId);
      return {}; // ensure ACK is called
    }),
  );

  // -----------------------------
  // SOFT DELETE MESSAGE
  // -----------------------------
  socket.on(
    ChatEvents.DELETE_SOFT,
    safeHandler(async ({ messageId }) => {
      await chatService.softDeleteMessage({ messageId, userId });
      logger.info(`[Chat] User ${userId} soft-deleted message ${messageId}`);
      return {};
    }),
  );

  // -----------------------------
  // HARD DELETE MESSAGE
  // -----------------------------
  socket.on(
    ChatEvents.DELETE_HARD,
    safeHandler(async ({ messageId }) => {
      const message = await chatService.deleteMessageForEveryone({
        user: socket.user,
        messageId,
      });
      broadcaster.notifyDeletedForAll(message.chatRoom.toString(), messageId);
      logger.info(
        `[Chat] User ${userId} deleted message ${messageId} for everyone`,
      );
      return {};
    }),
  );

  // -----------------------------
  // TYPING INDICATOR
  // -----------------------------
  socket.on(
    ChatEvents.USER_TYPING,
    safeHandler(async ({ chatRoomId, isTyping }) => {
      await ensureChatAccess(userId, chatRoomId);
      broadcaster.notifyTyping(chatRoomId, userId, isTyping);
      return {};
    }),
  );

  // -----------------------------
  // LEAVE ROOM
  // -----------------------------
  socket.on(ChatEvents.LEAVE, ({ chatRoomId }, ack) => {
    socket.leave(chatRoomId);
    logger.info(`[Chat] User ${userId} left room ${chatRoomId}`);
    ack?.({ success: true });
  });

  // -----------------------------
  // DISCONNECT
  // -----------------------------
  socket.on("disconnect", () => {
    logger.info(`[Chat] User ${userId} disconnected`);
  });
};
