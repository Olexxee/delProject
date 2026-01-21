// ============================================
// GROUP SERVICE WITH CHAT & ENCRYPTION
// ============================================

import * as groupDb from "../groupLogic/gSchemaService.js";
import * as membership from "../groupLogic/membershipSchemaService.js";
import * as userService from "../user/userService.js";
import * as chatRoomService from "../chat/chats/chatRoomService.js";
import { sendNotification } from "../notifications/notificationService.js";
import { NotificationTypes } from "../notifications/NotificationTypes.js";
import { getEmailTemplate } from "../notifications/emailTemplates.js";
import configService from "../lib/classes/configClass.js";
import {
  ConflictException,
  NotFoundException,
  BadRequestError,
  ForbiddenException,
} from "../lib/classes/errorClasses.js";
import { generateKey } from "../utils/encryption.js"; // AES key generator

// ==================================================
// 1️⃣ VALIDATE GROUP CREATION
// ==================================================
export const validateGroupCreation = async ({ userId, groupName }) => {
  const user = await userService.findUserById(userId);
  if (!user) throw new NotFoundException("User not found");

  const existingGroup = await groupDb.findGroupByName(groupName);
  if (existingGroup)
    throw new ConflictException("A group with this name already exists");

  return { user };
};

// ==================================================
// 2️⃣ CREATE GROUP WITH CHAT ROOM & AES KEY
// ==================================================
export const createGroupWithChat = async ({ userId, groupName, chatBroadcaster }) => {
  const { user } = await validateGroupCreation({ userId, groupName });

  // Generate AES key for end-to-end encryption
  const aesKey = generateKey();

  // Create the group
  const group = await groupDb.createGroup({
    name: groupName,
    admin: user._id,
    aesKey,
  });
  if (!group) throw new BadRequestError("Failed to create group");

  // Add admin as member
  await membership.createMembership({
    userId,
    groupId: group._id,
    role: "admin",
    status: "active",
  });

  // Create a chat room for this group
  const chatRoom = await chatRoomService.getOrCreateChatRoom({
    contextType: "group",
    contextId: group._id,
    userId,
  });

  // Notify creator
  await sendNotification({
    recipient: user._id,
    sender: "system",
    type: NotificationTypes.GROUP_CREATED,
    title: `Group "${group.name}" created 🎉`,
    message: `You are now the admin of "${group.name}".`,
    channels: ["inApp", "email"],
    meta: {
      email: user.email,
      payload: getEmailTemplate("GROUP_CREATED", {
        firstName: user.firstName,
        groupName: group.name,
        groupLink: `${configService.getBaseUrl()}/groups/${group._id}`,
      }),
    },
  });

  // Broadcast system message via socket
  if (chatBroadcaster) {
    chatBroadcaster.broadcastMessage(chatRoom._id, {
      system: true,
      content: `Group "${group.name}" created!`,
      sender: "system",
      createdAt: new Date(),
    });
  }

  return { group, chatRoom };
};

// ==================================================
// 3️⃣ JOIN GROUP WITH CHAT ROOM
// ==================================================
export const joinGroupByInviteWithChat = async (joinCode, userId, chatBroadcaster) => {
  const group = await groupDb.findGroupByJoinCode(joinCode);
  if (!group) throw new NotFoundException("Invalid invite link or group");

  const existing = await membership.findMembership({ userId, groupId: group._id });
  if (existing) throw new ConflictException("You are already a member of this group");

  const newMember = await membership.createMembership({
    userId,
    groupId: group._id,
    role: "member",
    status: "active",
  });

  // Notify admin
  const admin = await userService.findUserById(group.admin);
  if (admin) {
    await sendNotification({
      recipient: admin._id,
      sender: "system",
      type: NotificationTypes.MEMBER_JOINED,
      title: `${userId} joined "${group.name}"`,
      message: `${userId} joined your group`,
      channels: ["inApp", "email"],
      meta: {
        email: admin.email,
        payload: getEmailTemplate("MEMBER_JOINED", {
          firstName: admin.firstName,
          groupName: group.name,
          joinerName: userId,
        }),
      },
    });
  }

  // Broadcast system message in chat
  if (chatBroadcaster) {
    const chatRoom = await chatRoomService.getOrCreateChatRoom({
      contextType: "group",
      contextId: group._id,
      userId,
    });
    chatBroadcaster.broadcastMessage(chatRoom._id, {
      system: true,
      content: `${userId} joined the group`,
      sender: "system",
      createdAt: new Date(),
    });
  }

  return newMember;
};

// ==================================================
// 4️⃣ KICK MEMBER
// ==================================================
export const kickUserFromGroup = async ({ adminId, groupId, targetUserId, chatBroadcaster }) => {
  const adminMembership = await membership.findMembership({ userId: adminId, groupId });
  if (!adminMembership || adminMembership.role !== "admin")
    throw new ForbiddenException("Only admins can remove users");

  const targetMembership = await membership.findMembership({ userId: targetUserId, groupId });
  if (!targetMembership) throw new NotFoundException("Target user not a member");

  await membership.removeMembership({ userId: targetUserId, groupId });

  // Notify the removed user
  const targetUser = await userService.findUserById(targetUserId);
  if (targetUser) {
    await sendNotification({
      recipient: targetUser._id,
      sender: "system",
      type: NotificationTypes.MEMBER_REMOVED,
      title: `Removed from group`,
      message: `You have been removed from "${groupId}"`,
      channels: ["inApp", "email"],
      meta: {
        email: targetUser.email,
        payload: getEmailTemplate("MEMBER_REMOVED", {
          firstName: targetUser.firstName,
          groupName: groupId,
        }),
      },
    });
  }

  // Broadcast system message in chat
  if (chatBroadcaster) {
    const chatRoom = await chatRoomService.getOrCreateChatRoom({
      contextType: "group",
      contextId: groupId,
      userId: adminId,
    });
    chatBroadcaster.broadcastMessage(chatRoom._id, {
      system: true,
      content: `${targetUserId} was removed from the group`,
      sender: "system",
      createdAt: new Date(),
    });
  }

  return true;
};

// ==================================================
// 5️⃣ CHANGE MEMBER ROLE
// ==================================================
export const changeMemberRole = async ({ adminId, groupId, targetUserId, newRole }) => {
  const adminMembership = await membership.findMembership({ userId: adminId, groupId });
  if (!adminMembership || adminMembership.role !== "admin")
    throw new ForbiddenException("Only admins can change roles");

  const updated = await membership.updateMembership(
    { userId: targetUserId, groupId },
    { role: newRole }
  );
  if (!updated) throw new BadRequestError("Failed to update role");

  const targetUser = await userService.findUserById(targetUserId);
  if (targetUser) {
    await sendNotification({
      recipient: targetUser._id,
      sender: "system",
      type: NotificationTypes.MEMBER_ROLE_CHANGED,
      title: `Role changed in "${groupId}"`,
      message: `Your role is now "${newRole}"`,
      channels: ["inApp", "email"],
      meta: {
        email: targetUser.email,
        payload: getEmailTemplate("MEMBER_ROLE_CHANGED", {
          firstName: targetUser.firstName,
          groupName: groupId,
          newRole,
        }),
      },
    });
  }

  return updated;
};

// ==================================================
// 6️⃣ LEAVE GROUP
// ==================================================
export const leaveGroup = async ({ userId, groupId, chatBroadcaster }) => {
  const membershipRecord = await membership.findMembership({ userId, groupId });
  if (!membershipRecord)
    throw new NotFoundException("You are not a member of this group");

  if (membershipRecord.role === "admin")
    throw new ForbiddenException("Admin cannot leave without transferring ownership");

  await membership.removeMembership({ userId, groupId });

  const leaver = await userService.findUserById(userId);

  // Notify all admins
  const admins = await membership.findAdminsByGroup(groupId);
  for (const admin of admins) {
    await sendNotification({
      recipient: admin.userId,
      sender: "system",
      type: NotificationTypes.MEMBER_LEFT,
      title: `${leaver.firstName} left "${groupId}"`,
      message: `${leaver.firstName} has left the group`,
      channels: ["inApp", "email"],
      meta: {
        email: admin.email,
        payload: getEmailTemplate("MEMBER_LEFT", {
          firstName: admin.firstName,
          groupName: groupId,
          leaverName: leaver.firstName,
        }),
      },
    });
  }

  // Broadcast system message in chat
  if (chatBroadcaster) {
    const chatRoom = await chatRoomService.getOrCreateChatRoom({
      contextType: "group",
      contextId: groupId,
      userId,
    });
    chatBroadcaster.broadcastMessage(chatRoom._id, {
      system: true,
      content: `${leaver.firstName} left the group`,
      sender: "system",
      createdAt: new Date(),
    });
  }

  return true;
};

// ==================================================
// 7️⃣ GENERATE INVITE LINK
// ==================================================
export const generateInviteLink = async ({ adminId, groupId }) => {
  const adminMembership = await membership.findMembership({ userId: adminId, groupId });
  if (!adminMembership || adminMembership.role !== "admin")
    throw new ForbiddenException("Only admins can generate invite links");

  const inviteCode = await groupDb.createInviteCode(groupId);
  const group = await groupDb.findGroupById(groupId);

  return `${configService.getBaseUrl()}/groups/join/${inviteCode}`;
};
