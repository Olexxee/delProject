import * as groupService from "../groupLogic/groupService.js";
import {
  ValidationException,
  NotFoundException,
} from "../lib/classes/errorClasses.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as userService from "../user/userService.js";
import { ValidatorClass } from "../lib/classes/validatorClass.js";
import { createGroupSchema, updateGroupSchema } from "./groupRequestSchema.js";
import { asyncWrapper } from "../lib/utils.js";

const validator = new ValidatorClass();

export const createGroup = asyncWrapper(async (req, res) => {
  // 1. Validate the input
  const { errors, value } = validator.validate(createGroupSchema, req.body);
  if (errors) throw new ValidationException(errors);

  const userId = req.user._id;
  const email = req.user.email;

  // 2. Create the group
  const group = await groupService.createGroup(
    {
      ...value,
      userId,
    },
    email
  );

  // 3. Create membership for the creator (admin)

  const membership = await membershipService.createMembership({
    userId,
    groupId: group._id,
    roleInGroup: "admin",
    status: "active",
  });

  // 4. Update user stats
  await userService.findUserByIdAndUpdate(userId, {
    $inc: { groupsCreatedCount: 1, adminGroupsCount: 1 },
    $push: { groupsCreated: group._id },
  });

  // 5. Respond
  console.log("✅ Group successfully created:", group);

  res.status(201).json({
    success: true,
    message: "Group created successfully",
    group,
    membership,
  });
});

export const getGroupByName = asyncWrapper(async (req, res) => {
  const group = await groupService.findGroupByName(req.params.name);
  console.log("🚀 Controller hit:", req.params.name);
  if (!group) throw new NotFoundException("Group not found");
  res.status(200).json({ success: true, group });
});

export const generateInviteLink = asyncWrapper(async (req, res) => {
  const invite = await groupService.generateInviteLink(
    req.params.groupId,
    req.user._id
  );

  const user = await userService.findUserById(req.user._id);
  if (!user) throw new NotFoundException("User not found");

  res.status(200).json({
    success: true,
    invite,
    message: `Invite link sent to ${user.email}`,
  });
});

export const joinGroupByInvite = asyncWrapper(async (req, res) => {
  const joined = await groupService.joinGroupByInvite(
    req.params.joinCode,
    req.user._id
  );

  res.status(200).json({
    success: true,
    message: "Successfully joined the group",
    joined,
  });
});

export const getGroupMembers = asyncWrapper(async (req, res) => {
  const members = await groupService.getGroupMembers(req.params.groupId);
  res.status(200).json({ success: true, members });
});

export const leaveGroup = asyncWrapper(async (req, res) => {
  await groupService.leaveGroup(req.user._id, req.params.groupId);
  res.status(200).json({ success: true, message: "You have left the group" });
});

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

export const changeMemberRole = asyncWrapper(async (req, res) => {
  const { groupId, userId: targetUserId } = req.params;
  const { newRole } = req.body;

  const updated = await groupService.changeMemberRole({
    adminId: req.user._id,
    groupId,
    targetUserId,
    newRole,
  });

  res.status(200).json({
    success: true,
    message: "User role updated",
    updated,
  });
});
