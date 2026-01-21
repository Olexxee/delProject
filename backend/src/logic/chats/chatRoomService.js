import ChatRoom from "../../models/chatRoomSchema.js";

export const getOrCreateChatRoom = async ({
  contextType,
  contextId,
  userId,
}) => {
  let room = await ChatRoom.findOne({
    contextType,
    contextId,
    participants: userId,
  });

  if (!room) {
    room = await ChatRoom.create({
      contextType,
      contextId,
      participants: [userId],
    });
  }

  return room;
};
