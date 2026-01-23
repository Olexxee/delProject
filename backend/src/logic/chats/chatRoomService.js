import ChatRoom from "../../models/chatRoomSchema.js";
import * as membershipService from "../../groupLogic/membershipService.js";
import {
  NotFoundException,
  ForbiddenError,
} from "../../lib/classes/errorClasses.js";
import {generateRoomKey} from "./chatRoomKeyService.js";



/**
 * Get or create chat room for a context (group / direct / event)
 */
export const getOrCreateChatRoom = async ({
  contextType,
  contextId,
  userId,
}) => {
  // 1️⃣ Validate access (groups must enforce membership)
  if (contextType === "group") {
    const membership = await membershipService.findMembership({
      userId,
      groupId: contextId,
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this group");
    }
  }

  // 2️⃣ Find existing room (idempotent)
  let room = await ChatRoom.findOne({
    contextType,
    contextId,
  });

  // 3️⃣ Create if missing
  if (!room) {
    room = await ChatRoom.create({
      contextType,
      contextId,
      participants: [userId],
      aesKey: generateRoomKey().toString("hex"),
      encryptionVersion: 1,
      lastMessageAt: new Date(),
    });

    return room;
  }

  // 4️⃣ Ensure participant is added (group joins, late entry)
  if (!room.participants.includes(userId)) {
    room.participants.push(userId);
    await room.save();
  }

  return room;
};
