import ChatRoom from "./chatSchema.js";
import Message from "./messageSchema.js";

/**
 * 🔍 Find existing peer chat based on context (Match, Buddy, Event, Mart, Group)
 */
export const findChatRoom = async (
  userId,
  otherUserId,
  contextType,
  contextId
) => {
  return await ChatRoom.findOne({
    contextType,
    contextId,
    participants: { $all: [userId, otherUserId] },
  }).populate("participants", "username profilePicture");
};

/**
 * ➕ Create a peer chat room
 */
export const createPeerChatRoom = async (
  userId,
  otherUserId,
  contextType,
  contextId
) => {
  const chatRoom = new ChatRoom({
    participants: [userId, otherUserId],
    contextType,
    contextId,
  });

  return await chatRoom.save();
};

/**
 * 👥 Create a group chat room (for Events, Mart, or custom Group context)
 */
export const createGroupChatRoom = async (
  participantIds,
  contextType,
  contextId
) => {
  const chatRoom = new ChatRoom({
    participants: participantIds,
    contextType,
    contextId,
  });

  return await chatRoom.save();
};

/**
 * 📚 Fetch all chat rooms for a user
 */
export const getUserChatRooms = async (userId) => {
  return await ChatRoom.find({
    participants: userId,
  })
    .populate("participants", "username profilePicture")
    .sort({ updatedAt: -1 });
};

/**
 * 💬 Create and save a new message in a chat room
 */
export const createMessage = async ({
  chatRoomId,
  senderId,
  content,
  media = [],
}) => {
  const message = new Message({
    chatRoom: chatRoomId,
    sender: senderId,
    content,
    media,
  });

  const savedMessage = await message.save();

  // Update the chat room's last activity
  await ChatRoom.findByIdAndUpdate(chatRoomId, { updatedAt: new Date() });

  return await savedMessage.populate("sender", "username profilePicture");
};

/**
 * 🗑️ Delete a chat room
 */
export const deleteChatRoom = async (chatRoomId) => {
  return await ChatRoom.findByIdAndDelete(chatRoomId);
};

/**
 * 🧹 Delete all messages in a chat room
 */
export const clearChatMessages = async (chatRoomId) => {
  return await Message.deleteMany({ chatRoom: chatRoomId });
};
