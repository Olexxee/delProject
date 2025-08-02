import * as membershipService from "./membershipSchemaService.js";
import * as userService from "../user/userService.js";
import Group from "./groupSchema.js";
import * as userStats from "../user/statschemaService.js";
import * as groupDb from "./gSchemaService.js";
import {
  NotFoundException,
  ConflictException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";

// Create membership (on join, group creation, createUserStats)
export const createMembership = async (payload) => {
  const { userId, groupId, roleInGroup = "member" } = payload;

  const existing = await membershipService.findMembership({ userId, groupId });
  if (existing) return existing;

  const membership = await membershipService.createMembership({
    userId,
    groupId,
    roleInGroup,
    status: "active",
    joinedAt: new Date(),
  });

  const group = await groupDb.findGroupById(groupId);
  if (!group) throw new NotFoundException("Group not found");

  await groupDb.updateGroup(groupId, { $inc: { totalMembers: 1 } });

  await userService.findAndUpdateUserById(userId, {
    $addToSet: { groups: group.name },
  });

  // ✅ Create group-wide user stats (tournament will be null)
  try {
    await userStats.createUserStats({
      user: userId,
      group: groupId,
      tournamentsPlayedin: null,
    });
  } catch (err) {
    if (err.code !== 11000) {
      console.error("Error creating user stats:", err);
    }
  }

  return membership;
};

// Get membership by user + group
export const findMembership = async (payload) => {
  const { userId, groupId } = payload;
  return await membershipService.findMembership({ userId, groupId });
};

// Get all members of a group
export const findAllMembersInGroup = async (groupId) => {
  return await membershipService
    .find({ groupId })
    .populate("userId", "username email profilePicture")
    .select("roleInGroup status joinedAt");
};

// Get all groups a user belongs to
export const findGroupsByUser = async (userId) => {
  return await membershipService.findGroupsByUser({
    userId,
    status: "active",
  });
};

// Update membership (role or status)
export const updateMembership = async (payload) => {
  const { userId, groupId, ...updateFields } = payload;
  return await membershipService.updateMembership(
    { userId, groupId },
    updateFields,
    {
      new: true,
    }
  );
};

// Remove user from group
export const removeMembership = async (payload) => {
  const { userId, groupId } = payload;
  const deleted = await membershipService.removeMembership({ userId, groupId });

  if (deleted) {
    await groupDb.findByIdAndUpdate(groupId, { $inc: { totalMembers: -1 } });
  }

  return deleted;
};

// Ensure user is admin in group
export const assertIsAdmin = async (payload) => {
  const { userId, groupId } = payload;
  const membership = await membershipService.findMembership({
    userId,
    groupId,
  });
  if (!membership || membership.roleInGroup !== "admin") {
    throw new ForbiddenError("Only group admins can perform this action");
  }
};

// Optional: Ban a user from group
export const banUserInGroup = async (payload) => {
  const { adminId, groupId, targetUserId } = payload;

  await assertIsAdmin({ userId: adminId, groupId });

  const targetMembership = await membershipService.findMembership({
    userId: targetUserId,
    groupId,
  });

  if (!targetMembership) throw new NotFoundException("User not in this group");

  return await updateMembership({
    userId: targetUserId,
    groupId,
    status: "banned",
  });
};
