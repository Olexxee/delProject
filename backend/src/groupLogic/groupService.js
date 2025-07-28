import * as groupDb from "../groupLogic/gSchemaService.js";
import * as userService from "../user/userService.js";
import * as membership from "../groupLogic/membershipSchemaService.js";
import configService from "../lib/classes/configClass.js";
import * as membershipService from "../groupLogic/membershipService.js";
import transport from "../lib/classes/nodeMailerClass.js";

import {
  ConflictException,
  NotFoundException,
  BadRequestError,
  UnauthorizedException,
} from "../lib/classes/errorClasses.js";

// 1. Validate group creation

export const validateGroupCreation = async ({ userId, groupName }) => {
  const user = await userService.findUserById(userId);

  if (!user) {
    throw new NotFoundException("User not found");
  }

  const existingGroup = await groupDb.findGroupByName(groupName);
  if (existingGroup) {
    throw new ConflictException("A group with this name already exists");
  }

  return { user };
};

// 2. Create a new group
export const createGroup = async (payload) => {
  const { user } = await validateGroupCreation(payload);

  const group = await groupDb.createGroup({
    ...payload,
    admin: user._id,
  });

  if (!group) throw new BadRequestError("Failed to create group");

  return group;
};


// 3. Get group by Nmae search

export const findGroupByName = async (groupName) => {
  const name = groupName.trim();

  console.log("🔍 Querying for groupName:", name);

  const result = await groupDb.findGroupByName(name);

  console.log("📎 Query result:", result);
  return result;
};

// 4. Generate invite link
export const generateInviteLink = async (groupId, userId) => {
  const group = await groupDb.findGroupById(groupId);
  if (!group) throw new NotFoundException("Group not found");

  const member = await membership.findMembership({ userId, groupId });
  if (!member) {
    throw new UnauthorizedException("You are not a member of this group");
  }

  const inviteLink = `${configService.getBaseUrl()}/join-group/${
    group.joinCode
  }`;

  return { inviteLink };
};

// 5. Join group via invite link
export const joinGroupByInvite = async (joinCode, userId) => {
  const group = await groupDb.findGroupByJoinCode(joinCode);
  if (!group) throw new NotFoundException("Invalid invite link or group");

  const existing = await membership.findMembership({
    userId,
    groupId: group._id,
  });
  if (existing) {
    throw new ConflictException("You are already a member of this group");
  }

  const newMember = await membership.createMembership({
    userId,
    groupId: group._id,
    role: "member",
    status: "active",
  });

  return newMember;
};

// 6. Get all members in a group
export const getGroupMembers = async (groupId) => {
  const group = await groupDb.findGroupById(groupId);
  if (!group) throw new NotFoundException("Group not found");

  return await membership.findAllMembersInGroup(groupId);
};

// 7. Leave a group
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

// 8. Kick a user from group (admin only)
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
  if (!targetMembership) {
    throw new NotFoundException("Target user is not a member of this group");
  }

  await userService.timesFlaggedUser({ id: targetUserId });

  return await membership.removeMembership({ userId: targetUserId, groupId });
};

// 9. Change a member's role (admin only)
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
