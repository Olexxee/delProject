import { ForbiddenError } from "../../lib/classes/errorClasses.js";
import * as membershipService from "../../groupLogic/membershipService.js";

export const ensureChatAccess = async ({ chatRoom, userId }) => {
  if (chatRoom.contextType === "group") {
    const membership = await membershipService.findMembership({
      userId,
      groupId: chatRoom.contextId,
      status: "active",
    });

    if (!membership) {
      throw new ForbiddenError("You are not an active member of this group");
    }

    return true;
  }

  if (
    !chatRoom.participants ||
    !chatRoom.participants.some(id => id.equals(userId))
  ) {
    throw new ForbiddenError("You are not a participant of this chat");
  }

  return true;
};


