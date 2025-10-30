import * as membershipService from "./membershipService.js";
import * as userService from "../user/userService.js";
import { asyncWrapper } from "../lib/utils.js";
import {
  BadRequestError,
  NotFoundException,
} from "../lib/classes/errorClasses.js";
import { ValidatorClass } from "../lib/classes/validatorClass.js";

const validator = new ValidatorClass();

/* ---------------------------------------------------------
   🧠 1️⃣ Join group
--------------------------------------------------------- */
export const joinGroup = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  const membership = await membershipService.createMembership({
    userId,
    groupId,
  });

  // Update user’s group stats if successfully joined
  if (membership) {
    await userService.findUserByIdAndUpdate(userId, {
      $inc: { groupsJoinedCount: 1 },
      $push: { groupsJoined: groupId },
    });
  }

  res.status(201).json({
    success: true,
    message: "Joined group successfully",
    membership,
  });
});

/* ---------------------------------------------------------
   🚪 2️⃣ Leave group
--------------------------------------------------------- */
export const leaveGroup = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  const left = await membershipService.removeMembership({ userId, groupId });
  if (!left) throw new NotFoundException("You are not a member of this group");

  res.status(200).json({
    success: true,
    message: "Left group successfully",
  });
});

/* ---------------------------------------------------------
   👥 3️⃣ Get all members of a group
--------------------------------------------------------- */
export const getGroupMembers = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const members = await membershipService.findAllMembersInGroup(groupId);

  res.status(200).json({
    success: true,
    members,
  });
});

/* ---------------------------------------------------------
   🧩 4️⃣ Get all groups a user belongs to
--------------------------------------------------------- */
export const getUserGroups = asyncWrapper(async (req, res) => {
  const userId = req.user._id;
  const groups = await membershipService.findGroupsByUser(userId);

  res.status(200).json({
    success: true,
    groups,
  });
});

/* ---------------------------------------------------------
   ⚙️ 5️⃣ Update membership (role, mute, or status)
--------------------------------------------------------- */
export const updateMembership = asyncWrapper(async (req, res) => {
  const { groupId, userId } = req.params;
  const updateData = req.body;

  const updated = await membershipService.updateMembership({
    userId,
    groupId,
    ...updateData,
  });

  if (!updated)
    throw new BadRequestError("Membership not found or update failed");

  res.status(200).json({
    success: true,
    message: `Membership updated for user ${userId}`,
    updated,
  });
});

/* ---------------------------------------------------------
   🚫 6️⃣ Ban user from group (admin only)
--------------------------------------------------------- */
export const banUser = asyncWrapper(async (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const adminId = req.user._id;

  const result = await membershipService.banUserInGroup({
    adminId,
    groupId,
    targetUserId,
  });

  res.status(200).json({
    success: true,
    message: "User has been banned from the group",
    result,
  });
});

/* ---------------------------------------------------------
   🔇 7️⃣ Mute or unmute group notifications
--------------------------------------------------------- */
export const toggleMemberMute = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;
  const { mute } = req.body; // expects { mute: true } or { mute: false }

  const result = await membershipService.toggleMemberMute({
    userId,
    groupId,
    mute,
  });

  res.status(200).json({
    success: true,
    message:
      result.message ||
      `Notifications ${mute ? "muted" : "unmuted"} for this group`,
    updated: result,
  });
});
