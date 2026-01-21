import * as chatRoomService from "../../models/chatSchemaService.js"
import { ForbiddenError } from "../../lib/classes/errorClasses.js";

export const ensureChatAccess = async (userId, chatRoomId) => {
  const chatRoom = await chatRoomService.findChatById(chatRoomId);
  if (!chatRoom) return null;

  const isParticipant = chatRoom.participants.map(String).includes(userId);

  if (!isParticipant) {
    throw new ForbiddenError("You are not a participant of this chat");
  }

  return chatRoom;
};
