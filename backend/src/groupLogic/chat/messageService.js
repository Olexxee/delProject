import * as messageDB from "../../models/messageSchemaService.js";
import * as errorService from "../../lib/classes/errorClasses.js";
import * as mediaService from "../media/mediaService.js";

/**
 * ✉️ Handle sending a message
 */
export const handleSendMessage = async ({
  chatId,
  senderId,
  content,
  media,
}) => {
  if (!content && (!media || media.length === 0))
    throw new errorService.ForbiddenError("Message cannot be empty");

  const message = await messageDB.createMessage({
    chatId,
    sender: senderId,
    content,
    mediaId: media?._id || null,
  });

  return message;
};

/**
 * Edit a message
 */
export const handleEditMessage = async (messageId, userId, newContent) => {
  const message = await messageDB.getMessageById(messageId);
  if (!message) throw new errorService.NotFoundException("Message not found");

  if (message.sender._id.toString() !== userId.toString())
    throw new errorService.ForbiddenError(
      "You can only edit your own messages"
    );

  // Optionally, enforce edit time limit (e.g., 10 minutes)
  const timeDiff = (Date.now() - message.createdAt.getTime()) / (1000 * 60);
  if (timeDiff > 10)
    throw new errorService.ForbiddenError(
      "Message can only be edited within 10 minutes"
    );

  const updated = await messageDB.updateMessage(messageId, {
    content: newContent,
    edited: true,
  });
  return updated;
};

/**
 * ❌ Delete message
 */
export const handleDeleteMessage = async (messageId, userId) => {
  const message = await messageDB.getMessageById(messageId);
  if (!message) throw new errorService.NotFoundException("Message not found");

  if (message.sender._id.toString() !== userId.toString())
    throw new errorService.ForbiddenError(
      "You can only delete your own messages"
    );

  if (message.mediaId)
    await mediaService.deleteMedia(message.mediaId.toString());

  const updated = await messageDB.updateMessage(messageId, {
    content: null,
    mediaId: null,
    isDeleted: true,
  });

  return updated;
};
