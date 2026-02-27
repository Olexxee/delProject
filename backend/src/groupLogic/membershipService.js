import * as membershipService from "./membershipSchemaService.js";
import * as userService from "../user/userService.js";
import mongoose from "mongoose";
import Group from "./groupSchema.js";
import * as userStats from "../user/statschemaService.js";
import * as groupDb from "./gSchemaService.js";
import {
  NotFoundException,
  ConflictException,
  ForbiddenError,
  BadRequestError,
} from "../lib/classes/errorClasses.js";

// Create membership (on join, group creation, createUserStats)
export const createMembership = async (payload) => {
  const { userId, groupId, roleInGroup = "member" } = payload;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const group = await groupDb.findGroupById(groupId, session);
    if (!group) throw new NotFoundException("Group not found");

    const existing = await membershipService.findMembership(
      { userId, groupId },
      session,
    );
    if (existing) {
      await session.commitTransaction();
      return existing;
    }

    const membership = await membershipService.createMembership(
      {
        userId,
        groupId,
        roleInGroup,
        status: "active",
      },
      session,
    );

    await groupDb.updateGroup(groupId, { $inc: { totalMembers: 1 } }, session);

    await userService.findAndUpdateUserById(
      userId,
      { $addToSet: { groups: group.name } },
      session,
    );

    await userStats.createUserStats(
      {
        user: userId,
        group: groupId,
        tournamentsPlayedin: null,
      },
      session,
    );

    await session.commitTransaction();
    return membership;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
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

// Update membership (role or status)
export const updateMembership = async (payload) => {
  const { userId, groupId, ...updateFields } = payload;
  return await membershipService.updateMembership(
    { userId, groupId },
    updateFields,
    {
      new: true,
    },
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

// Request to join a private group (status: "pending")
export const requestToJoinGroup = async (payload) => {
  const { userId, groupId } = payload;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const group = await groupDb.findGroupById(groupId, session);
    if (!group) throw new NotFoundException("Group not found");

    const existing = await membershipService.findMembership(
      { userId, groupId },
      session,
    );

    if (existing) {
      await session.commitTransaction();
      if (existing.status === "pending") {
        throw new ConflictException("You already have a pending join request");
      }
      if (existing.status === "active") {
        throw new ConflictException("You are already a member of this group");
      }
      if (existing.status === "banned") {
        throw new ForbiddenError("You are banned from this group");
      }
    }

    const membership = await membershipService.createMembership(
      {
        userId,
        groupId,
        roleInGroup: "member",
        status: "pending",
      },
      session,
    );

    await session.commitTransaction();
    return membership;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// Approve or reject a pending join request (admin only)
export const resolveJoinRequest = async (payload) => {
  const { adminId, groupId, targetUserId, action } = payload;

  if (!["approve", "reject"].includes(action)) {
    throw new BadRequestError("Action must be 'approve' or 'reject'");
  }

  await assertIsAdmin({ userId: adminId, groupId });

  const targetMembership = await membershipService.findMembership({
    userId: targetUserId,
    groupId,
  });

  if (!targetMembership) {
    throw new NotFoundException("No join request found for this user");
  }

  if (targetMembership.status !== "pending") {
    throw new ConflictException("This user does not have a pending request");
  }

  if (action === "reject") {
    await membershipService.removeMembership({ userId: targetUserId, groupId });
    return { action: "rejected", userId: targetUserId };
  }

  // Approve — activate membership and bump member count
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const approved = await membershipService.updateMembership(
      { userId: targetUserId, groupId },
      { status: "active" },
      { new: true },
      session,
    );

    await groupDb.updateGroup(groupId, { $inc: { totalMembers: 1 } }, session);

    const group = await groupDb.findGroupById(groupId, session);
    await userService.findAndUpdateUserById(
      targetUserId,
      { $addToSet: { groups: group.name } },
      session,
    );

    await userStats.createUserStats(
      { user: targetUserId, group: groupId, tournamentsPlayedin: null },
      session,
    );

    await session.commitTransaction();
    return { action: "approved", membership: approved };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export const countPendingRequests = async (groupId, status = "pending") => {
  return await membershipService.countMemberships({
    groupId,
    status,
  });
};

// Get all pending join requests for a group
export const getPendingRequests = async (groupId) => {
  return await membershipService.findMemberships(
    { groupId, status: "pending" },
    { populate: { path: "userId", select: "username email profilePicture" } },
  );
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
