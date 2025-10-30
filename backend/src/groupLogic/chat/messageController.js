import { asyncWrapper } from "../../lib/utils.js";
import {
  handleSendMessage,
  handleEditMessage,
  handleDeleteMessage,
} from "./messageService.js";
import { emitNewMessage } from "../socket/chatSocket.js";

// Send a message
export const sendMessage = asyncWrapper(async (req, res) => {
  const { chatId, content, media } = req.body;
  const senderId = req.user.id;

  const message = await handleSendMessage({
    chatId,
    senderId,
    content,
    media,
  });

  emitNewMessage(chatId, message);

  res.status(201).json({ success: true, message });
});

// Edit message
export const editMessage = asyncWrapper(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  const updated = await handleEditMessage(messageId, userId, content);

  res.status(200).json({ success: true, message: updated });
});

// Delete message
export const deleteMessage = asyncWrapper(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const deleted = await handleDeleteMessage(messageId, userId);

  res.status(200).json({ success: true, message: deleted });
});
