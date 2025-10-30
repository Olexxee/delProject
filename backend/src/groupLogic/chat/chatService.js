import * as chatRoomService from "../../services/chatRoomService.js";
import * as messageService from "../../services/messageService.js";
import * as errorService from "../../lib/classes/errorClasses.js";

/**
 * 🧩 Handle peer-to-peer chat creation or retrieval
 */
export const handlePeerChat = async (
  userId,
  otherUserId,
  contextType,
  contextId
) => {
  if (userId === otherUserId)
    throw new errorService.ForbiddenError("You cannot chat with yourself");

  // 🔍 Find an existing chat room for this context
  let chatRoom = await chatRoomService.findChatRoom(
    userId,
    otherUserId,
    contextType,
    contextId
  );

  // If it exists, return it
  if (chatRoom) return chatRoom;

  // ➕ Otherwise, create a new one
  chatRoom = await chatRoomService.createPeerChatRoom(
    userId,
    otherUserId,
    contextType,
    contextId
  );

  return chatRoom;
};

/**
 * 👥 Handle group chat creation or retrieval
 */
export const handleGroupChat = async (participants, contextType, contextId) => {
  if (!participants || participants.length < 1)
    throw new errorService.ForbiddenError(
      "Group chat must have at least 1 participants"
    );

  // You can add a check if a chat already exists for that group/context
  const chatRoom = await chatRoomService.createGroupChatRoom(
    participants,
    contextType,
    contextId
  );

  return chatRoom;
};

/**
 * 📚 Fetch all user chat rooms
 */
export const fetchUserChats = async (userId) => {
  const chatRooms = await chatRoomService.getUserChatRooms(userId);
  return chatRooms;
};

/**
 * 💬 Fetch all messages in a chat room
 */
export const fetchChatMessages = async (chatRoomId) => {
  const messages = await messageService.getMessagesByChatRoom(chatRoomId);
  return messages;
};

