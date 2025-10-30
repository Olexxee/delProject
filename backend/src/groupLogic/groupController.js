import * as groupService from "../groupLogic/groupService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as userService from "../user/userService.js";

import {
  ValidationException,
  NotFoundException,
} from "../lib/classes/errorClasses.js";

import { ValidatorClass } from "../lib/classes/validatorClass.js";
import { asyncWrapper } from "../lib/utils.js";
import {
  createGroupSchema,
  updateGroupSchema,
  changeRoleSchema,
  toggleMuteSchema,
} from "./groupRequestSchema.js";

const validator = new ValidatorClass();

/* ---------------------------------------------------------
   🏗️ Create a new group (with chat context)
--------------------------------------------------------- */
export const createGroup = asyncWrapper(async (req, res) => {
  const { errors, value } = validator.validate(createGroupSchema, req.body);
  if (errors) throw new ValidationException(errors);

  const userId = req.user._id;
  const email = req.user.email;

  const { group, chat } = await groupService.createGroup({
    ...value,
    userId,
  });

  // Add membership (admin)
  const membership = await membershipService.createMembership({
    userId,
    groupId: group._id,
    roleInGroup: "admin",
    status: "active",
  });

  // Update user stats
  await userService.findUserByIdAndUpdate(userId, {
    $inc: { groupsCreatedCount: 1, adminGroupsCount: 1 },
    $push: { groupsCreated: group._id },
  });

  res.status(201).json({
    success: true,
    message: "Group created successfully",
    group,
    chat,
    membership,
  });
});

/* ---------------------------------------------------------
   🔍 Get group by name
--------------------------------------------------------- */
export const getGroupByName = asyncWrapper(async (req, res) => {
  const group = await groupService.findGroupByName(req.params.name);
  if (!group) throw new NotFoundException("Group not found");
  res.status(200).json({ success: true, group });
});

/* ---------------------------------------------------------
   ✉️ Generate invite link
--------------------------------------------------------- */
export const generateInviteLink = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  const invite = await groupService.generateInviteLink(groupId, userId);
  const user = await userService.findUserById(userId);

  if (!user) throw new NotFoundException("User not found");

  res.status(200).json({
    success: true,
    invite,
    message: `Invite link sent to ${user.email}`,
  });
});

/* ---------------------------------------------------------
   🚪 Join group via invite
--------------------------------------------------------- */
export const joinGroupByInvite = asyncWrapper(async (req, res) => {
  const { joinCode } = req.params;
  const userId = req.user._id;

  const joined = await groupService.joinGroupByInvite(joinCode, userId);

  res.status(200).json({
    success: true,
    message: "Successfully joined the group",
    joined,
  });
});

/* ---------------------------------------------------------
   👥 Get all members
--------------------------------------------------------- */
export const getGroupMembers = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const members = await groupService.getGroupMembers(groupId);

  res.status(200).json({ success: true, members });
});

/* ---------------------------------------------------------
   🚶‍♂️ Leave group
--------------------------------------------------------- */
export const leaveGroup = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  await groupService.leaveGroup(req.user._id, groupId);
  res.status(200).json({ success: true, message: "You have left the group" });
});

/* ---------------------------------------------------------
   🦶 Kick user (admin only)
--------------------------------------------------------- */
export const kickUserFromGroup = asyncWrapper(async (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  await groupService.kickUserFromGroup({
    adminId: req.user._id,
    groupId,
    targetUserId,
  });

  res.status(200).json({
    success: true,
    message: "User has been removed from the group",
  });
});

/* ---------------------------------------------------------
   🛠️ Change member role
--------------------------------------------------------- */
export const changeMemberRole = asyncWrapper(async (req, res) => {
  const { errors, value } = validator.validate(changeRoleSchema, req.body);
  if (errors) throw new ValidationException(errors);

  const { groupId, userId: targetUserId } = req.params;
  const { newRole } = value;

  const updated = await groupService.changeMemberRole({
    adminId: req.user._id,
    groupId,
    targetUserId,
    newRole,
  });

  res.status(200).json({
    success: true,
    message: "User role updated successfully",
    updated,
  });
});

/* ---------------------------------------------------------
   🔇 Mute or Unmute Group (Admin Only)
--------------------------------------------------------- */
export const toggleGroupMute = asyncWrapper(async (req, res) => {
  const { errors, value } = validator.validate(toggleMuteSchema, req.body);
  if (errors) throw new ValidationException(errors);

  const { groupId } = req.params;
  const { mute } = value;

  const result = await groupService.toggleGroupMute({
    adminId: req.user._id,
    groupId,
    mute,
  });

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

/* ---------------------------------------------------------
   🔕 Mute or Unmute Notifications (Membership-level)
--------------------------------------------------------- */
export const toggleMemberMute = asyncWrapper(async (req, res) => {
  const { errors, value } = validator.validate(toggleMuteSchema, req.body);
  if (errors) throw new ValidationException(errors);

  const { groupId } = req.params;
  const { mute } = value;

  const result = await groupService.toggleMemberMute({
    userId: req.user._id,
    groupId,
    mute,
  });

  res.status(200).json({
    success: true,
    message: result.message,
  });
});
