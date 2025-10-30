import * as groupDb from "../groupLogic/gSchemaService.js";
import * as userService from "../user/userService.js";
import * as membership from "../groupLogic/membershipSchemaService.js";
import * as chatLogic from "../chat/chatService.js";
import configService from "../lib/classes/configClass.js";
import transport from "../lib/classes/nodeMailerClass.js";
import {
  ConflictException,
  NotFoundException,
  BadRequestError,
  UnauthorizedException,
  ForbiddenException,
} from "../lib/classes/errorClasses.js";

/* ---------------------------------------------------------
   1️⃣ Validate group creation
--------------------------------------------------------- */
export const validateGroupCreation = async ({ userId, groupName }) => {
  const user = await userService.findUserById(userId);
  if (!user) throw new NotFoundException("User not found");

  const existingGroup = await groupDb.findGroupByName(groupName);
  if (existingGroup)
    throw new ConflictException("A group with this name already exists");

  return { user };
};

/* ---------------------------------------------------------
   2️⃣ Create a new group and its chat context
--------------------------------------------------------- */
export const createGroup = async (payload) => {
  const { user } = await validateGroupCreation(payload);

  const group = await groupDb.createGroup({
    ...payload,
    admin: user._id,
  });
  if (!group) throw new BadRequestError("Failed to create group");

  // Create chat context for this group
  const chat = await chatLogic.handleGroupChat(
    [user._id],
    "Group", // contextType
    group._id // contextId
  );

  await groupDb.updateGroup(group._id, { chatId: chat._id });
  return { group, chat };
};

/* ---------------------------------------------------------
   3️⃣ Get group by name
--------------------------------------------------------- */
export const findGroupByName = async (groupName) => {
  const name = groupName.trim();
  const result = await groupDb.findGroupByName(name);
  return result;
};

/* ---------------------------------------------------------
   4️⃣ Generate invite link
--------------------------------------------------------- */
export const generateInviteLink = async (groupId, userId) => {
  const group = await groupDb.findGroupById(groupId);
  if (!group) throw new NotFoundException("Group not found");

  const member = await membership.findMembership({ userId, groupId });
  if (!member)
    throw new UnauthorizedException("You are not a member of this group");

  const inviteLink = `${configService.getBaseUrl()}/join-group/${
    group.joinCode
  }`;
  return { inviteLink };
};

/* ---------------------------------------------------------
   5️⃣ Join group via invite link
--------------------------------------------------------- */
export const joinGroupByInvite = async (joinCode, userId) => {
  const group = await groupDb.findGroupByJoinCode(joinCode);
  if (!group) throw new NotFoundException("Invalid invite link or group");

  const existing = await membership.findMembership({
    userId,
    groupId: group._id,
  });
  if (existing)
    throw new ConflictException("You are already a member of this group");

  const newMember = await membership.createMembership({
    userId,
    groupId: group._id,
    role: "member",
    status: "active",
  });

  return newMember;
};

/* ---------------------------------------------------------
   6️⃣ Get all members in a group
--------------------------------------------------------- */
export const getGroupMembers = async (groupId) => {
  const group = await groupDb.findGroupById(groupId);
  if (!group) throw new NotFoundException("Group not found");

  return await membership.findAllMembersInGroup(groupId);
};

/* ---------------------------------------------------------
   7️⃣ Leave group
--------------------------------------------------------- */
export const leaveGroup = async (userId, groupId) => {
  const member = await membership.findMembership({ userId, groupId });
  if (!member) throw new NotFoundException("Membership not found");

  if (member.role === "admin") {
    throw new ForbiddenException(
      "Admin cannot leave the group directly. Transfer ownership first."
    );
  }

  return await membership.removeMembership({ userId, groupId });
};

/* ---------------------------------------------------------
   8️⃣ Kick user from group (admin only)
--------------------------------------------------------- */
export const kickUserFromGroup = async ({ adminId, groupId, targetUserId }) => {
  const adminMembership = await membership.findMembership({
    userId: adminId,
    groupId,
  });
  if (!adminMembership || adminMembership.role !== "admin") {
    throw new ForbiddenException("Only group admins can remove users");
  }

  const targetMembership = await membership.findMembership({
    userId: targetUserId,
    groupId,
  });
  if (!targetMembership)
    throw new NotFoundException("Target user is not a member of this group");

  await userService.timesFlaggedUser({ id: targetUserId });
  return await membership.removeMembership({ userId: targetUserId, groupId });
};

/* ---------------------------------------------------------
   9️⃣ Change member role (admin only)
--------------------------------------------------------- */
export const changeMemberRole = async ({
  adminId,
  groupId,
  targetUserId,
  newRole,
}) => {
  const adminMembership = await membership.findMembership({
    userId: adminId,
    groupId,
  });
  if (!adminMembership || adminMembership.role !== "admin") {
    throw new ForbiddenException("Only admins can change roles");
  }

  const updated = await membership.updateMembership(
    { userId: targetUserId, groupId },
    { role: newRole }
  );
  if (!updated) throw new BadRequestError("Failed to update role");
  return updated;
};

/* ---------------------------------------------------------
   🔇 10️⃣ Mute / Unmute group (admin only)
--------------------------------------------------------- */
export const toggleGroupMute = async ({ adminId, groupId, mute }) => {
  const adminMembership = await membership.findMembership({
    userId: adminId,
    groupId,
  });
  if (!adminMembership || adminMembership.role !== "admin") {
    throw new ForbiddenException("Only group admins can mute/unmute the group");
  }

  await groupDb.updateGroup(groupId, { isMuted: mute });
  return { message: `Group has been ${mute ? "muted" : "unmuted"}` };
};

/* ---------------------------------------------------------
   🔕 11️⃣ Mute notifications for a user (membership-level)
--------------------------------------------------------- */
export const toggleMemberMute = async ({ userId, groupId, mute }) => {
  const member = await membership.findMembership({ userId, groupId });
  if (!member)
    throw new NotFoundException("You are not a member of this group");

  const updated = await membership.updateMembership(
    { userId, groupId },
    { isMuted: mute }
  );

  return {
    message: `Notifications have been ${
      mute ? "muted" : "unmuted"
    } for this group`,
    updated,
  };
};
