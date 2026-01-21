import logger from "../../lib/logger.js";
import { asyncWrapper } from "../../lib/utils.js";
import * as connectionChatService from "./connectionChatService.js";
import { BadRequestError } from "../../lib/classes/errorClasses.js";

/**
 * Get or create chat room for a connection
 * GET /api/v1/chat/connection/:connectionId/room
 */
export const getConnectionChatRoom = asyncWrapper(async (req, res) => {
  const { connectionId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  const chatRoom = await connectionChatService.getOrCreateConnectionChatRoom(
    userId,
    connectionId
  );

  return res.status(200).json({
    success: true,
    data: chatRoom,
  });
});

/**
 * Get all connection chat rooms for the current user
 * GET /api/v1/chat/connection/rooms
 */
export const getConnectionChatRooms = asyncWrapper(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  const chatRooms = await connectionChatService.getUserConnectionChatRooms(userId);

  return res.status(200).json({
    success: true,
    count: chatRooms.length,
    data: chatRooms,
  });
});

/**
 * Send a message in a connection chat room
 * POST /api/v1/chat/connection/:connectionId/message
 */
export const sendConnectionMessage = asyncWrapper(async (req, res) => {
  const { connectionId } = req.params;
  const { content } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  if (!content || !content.trim()) {
    throw new BadRequestError("Message content is required");
  }

  const message = await connectionChatService.sendConnectionMessage(
    userId,
    connectionId,
    content
  );

  return res.status(201).json({
    success: true,
    message: "Message sent successfully",
    data: message,
  });
});

/**
 * Get messages for a connection chat room
 * GET /api/v1/chat/connection/:connectionId/messages
 */
export const getConnectionMessages = asyncWrapper(async (req, res) => {
  const { connectionId } = req.params;
  const { limit = 50, skip = 0 } = req.query;
  const userId = req.user?.id;

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  const messages = await connectionChatService.getConnectionMessages(
    userId,
    connectionId,
    parseInt(limit),
    parseInt(skip)
  );

  return res.status(200).json({
    success: true,
    count: messages.length,
    data: messages,
  });
});

/**
 * Mark messages as read in a connection chat room
 * POST /api/v1/chat/connection/:connectionId/read
 */
export const markConnectionMessagesRead = asyncWrapper(async (req, res) => {
  const { connectionId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  const result = await connectionChatService.markConnectionMessagesRead(
    userId,
    connectionId
  );

  return res.status(200).json({
    success: true,
    ...result,
  });
});

/**
 * Get unread count for a connection chat
 * GET /api/v1/chat/connection/:connectionId/unread
 */
export const getConnectionUnreadCount = asyncWrapper(async (req, res) => {
  const { connectionId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  const count = await connectionChatService.getConnectionUnreadCount(
    userId,
    connectionId
  );

  return res.status(200).json({
    success: true,
    unreadCount: count,
  });
});

