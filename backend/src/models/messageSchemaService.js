// models/messageSchemaService.js
import Message from "./messageModel.js";

/**
 * ➕ Create a new message
 */
export const createMessage = async (data) => {
  const message = await Message.create(data);
  return message;
};

/**
 * 📖 Get all messages in a specific chat
 */
export const getMessagesByChatId = async (chatId) => {
  const messages = await Message.find({ chatId })
    .populate("sender", "username profilePicture")
    .populate("mediaId")
    .sort({ createdAt: 1 });
  return messages;
};

/**
 * 🔍 Get a single message by its ID
 */
export const getMessageById = async (messageId) => {
  const message = await Message.findById(messageId)
    .populate("sender", "username profilePicture")
    .populate("mediaId");
  return message;
};

/**
 * ✏️ Update a message (used internally for editing or marking deleted)
 */
export const updateMessage = async (messageId, updates) => {
  const message = await Message.findByIdAndUpdate(messageId, updates, {
    new: true,
  });
  return message;
};

/**
 * ❌ Permanently delete a message (hard delete)
 */
export const deleteMessageById = async (messageId) => {
  const deleted = await Message.findByIdAndDelete(messageId);
  return deleted;
};
