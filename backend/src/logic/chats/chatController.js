import * as chatService from "../../logic/chats/chatService.js";
import { asyncWrapper } from "../../lib/utils.js";
import ChatBroadcaster from "../../logic/chats/chatBroadcaster.js";
import { io } from "../../server/serverConfig.js";

let broadcaster;

export const setIo = (ioInstance) => {
  broadcaster = new ChatBroadcaster(ioInstance);
  if (broadcaster) {
    console.log("broadcaster running");
  }
};

/**
 * Get or create chat room by context
 */
export const getChatRoom = asyncWrapper(async (req, res) => {
  const { contextType, contextId } = req.params;
  const userId = req.user.id;

  const chatRoom = await chatService.getOrCreateChatRoom({
    contextType,
    contextId,
    userId,
  });

  res.status(200).json({ success: true, data: { chatRoom } });
});

/**
 * Get messages
 */
export const getMessages = asyncWrapper(async (req, res) => {
  const { chatRoomId } = req.params;
  const { limit = 50, skip = 0 } = req.query;
  const userId = req.user.id;

  const messages = await chatService.getMessages({
    chatRoomId,
    userId,
    limit: parseInt(limit),
    skip: parseInt(skip),
  });

  res.status(200).json({
    success: true,
    data: {
      messages,
      count: messages.length,
      hasMore: messages.length === parseInt(limit),
    },
  });
});

/**
 * Send message with optional media
 */
export const sendMessage = asyncWrapper(async (req, res) => {
  const { chatRoomId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  const files = req.files || [];

  const message = await chatService.createMessage({
    chatRoomId,
    senderId: userId,
    content,
    files,
    requestContext: req,
  });

  // Emit to socket clients
  broadcaster.broadcastMessage(chatRoomId, message);

  res.status(201).json({
    success: true,
    message: "Message sent successfully",
    data: { message },
  });
});

/**
 * Soft delete message
 */
export const deleteMessage = asyncWrapper(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const result = await chatService.softDeleteMessage({ messageId, userId });

  // Optional: notify clients in real-time
  if (result) {
    broadcaster.notifyDeletedForAll(result.chatRoom.toString(), messageId);
  }

  res.status(200).json({
    success: true,
    message: "Message deleted successfully",
  });
});

/**
 * Hard delete message (sender/admin)
 */
export const deleteMessageForEveryone = asyncWrapper(async (req, res) => {
  const { messageId } = req.params;
  const user = req.user;

  const result = await chatService.deleteMessageForEveryone({
    user,
    messageId,
  });

  broadcaster.notifyDeletedForAll(result.chatRoom.toString(), messageId);

  res.status(200).json({
    success: true,
    message: "Message deleted for everyone",
  });
});

/**
 * Mark messages as read
 */
export const markMessagesAsRead = asyncWrapper(async (req, res) => {
  const { chatRoomId } = req.params;
  const userId = req.user.id;

  const updatedCount = await chatService.markRead({ chatRoomId, userId });

  // Notify socket clients
  broadcaster.notifyRead(chatRoomId, userId);

  res.status(200).json({
    success: true,
    message: "Messages marked as read",
    data: { updatedCount },
  });
});

/**
 * Get user chat rooms
 */
export const getUserChatRooms = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { limit = 20, skip = 0 } = req.query;

  const chatRooms = await chatService.getUserChatRooms({
    userId,
    limit: parseInt(limit),
    skip: parseInt(skip),
  });

  res.status(200).json({
    success: true,
    data: { chatRooms, count: chatRooms.length },
  });
});

/**
 * Offline sync (fetch messages since timestamp)
 */
export const syncMessages = asyncWrapper(async (req, res) => {
  const { chatRoomId } = req.params;
  const { since, limit = 50 } = req.query;
  const userId = req.user.id;

  const messages = await chatService.getMessagesSince({
    chatRoomId,
    userId,
    since,
    limit: parseInt(limit),
  });

  res.status(200).json({
    success: true,
    data: { messages, count: messages.length },
  });
});
