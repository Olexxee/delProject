import * as groupDb from "./gSchemaService.js";
import * as membershipService from "./membershipService.js";
import * as membershipCrud from "./membershipSchemaService.js";
import * as userService from "../user/userService.js";
import { serializeGroup } from "../lib/serializeUser.js";
import NotificationService from "../logic/notifications/notificationService.js";
import { NotificationTypes } from "../logic/notifications/notificationTypes.js";
import { getEmailTemplate } from "../logic/notifications/emailTemplates.js";
import configService from "../lib/classes/configClass.js";
import Message from "../models/messageSchema.js";
import Group from "./groupSchema.js";
import mongoose from "mongoose";
import { generateRoomKey } from "../logic/chats/chatRoomKeyService.js";
import { getOrCreateChatRoom } from "../logic/chats/chatRoomService.js";
import {
  BadRequestError,
  ConflictException,
  NotFoundException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";

/* =====================================================
   GET GROUP
===================================================== */

export const getGroupByName = async ({ name }) => {
  const group = await groupDb.findGroupByName(name);
  if (!group) throw new NotFoundException("Group not found");
  return group;
};

/* =====================================================
   CREATE GROUP (MEMBERSHIP-DRIVEN CHAT)
===================================================== */
export const createGroup = async ({
  userId,
  name,
  privacy,
  avatar,
  chatBroadcaster,
}) => {
  // 1️⃣ Validate user
  const user = await userService.findUserById(userId);
  if (!user) {
    throw new NotFoundException("User not found");
  }

  // 2️⃣ Prevent duplicate group names
  const existingGroup = await groupDb.findGroupByName(name);
  if (existingGroup) {
    throw new ConflictException("A group with this name already exists");
  }

  // 3️⃣ Create group
  const aesKey = generateRoomKey();

  let group = await groupDb.createGroup({
    name,
    privacy,
    avatar,
    admin: user._id,
    createdBy: user._id,
    aesKey,
  });

  if (!group) {
    throw new BadRequestError("Failed to create group");
  }

  // 4️⃣ Create membership
  await membershipService.createMembership({
    userId: user._id,
    groupId: group._id,
    role: "admin",
    status: "active",
  });

  // 5️⃣ Create or fetch chat room
  const chatRoom = await getOrCreateChatRoom({
    contextType: "group",
    contextId: group._id,
    userId: user._id,
  });

  // 6️⃣ Attach chat room
  group.chatRoom = chatRoom._id;
  await group.save();

  // 7️⃣ Populate relations
  group = await group.populate([{ path: "avatar" }, { path: "createdBy" }]);

  // 8️⃣ Update user groups (WRITE PATH — must be clean)
  user.groups = user.groups || [];
  user.groups.push(group._id);
  await user.save();

  // 9️⃣ Notification
  await NotificationService.send({
    recipient: user._id,
    sender: "system",
    type: NotificationTypes.GROUP_CREATED,
    title: `Group "${group.name}" created 🎉`,
    message: `You are now the admin of "${group.name}".`,
    channels: ["inApp", "email"],
    meta: {
      email: user.email,
      payload: getEmailTemplate("GROUP_CREATED", {
        firstName: user.name,
        groupName: group.name,
        groupLink: `${configService.getBaseUrl()}/groups/${group._id}`,
      }),
    },
  });

  // 🔊 Broadcast
  if (chatBroadcaster) {
    chatBroadcaster.broadcastMessage(group._id, {
      system: true,
      content: `Group "${group.name}" created!`,
      sender: "system",
      createdAt: new Date(),
    });
  }

  // 10️⃣ Serialize
  const serializedGroup = serializeGroup(group);
  const safeUser = {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    profilePicture: user.profilePicture,
    role: user.role,
    isActive: user.isActive,
    groups: populatedGroups,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  const validGroupIds = (user.groups || []).filter((id) =>
    mongoose.Types.ObjectId.isValid(id),
  );

  const populatedGroups = await Group.find({
    _id: { $in: validGroupIds },
  })
    .populate("avatar")
    .then((gs) => gs.map(serializeGroup));

  return {
    group: serializedGroup,
    chatRoom,
    user: safeUser,
  };
};

/* =====================================================
   UPDATE GROUP MEDIA
===================================================== */

export const updateGroupMedia = async ({
  groupId,
  userId,
  avatarMediaId,
  bannerMediaId,
}) => {
  const group = await groupDb.findGroupById(groupId);
  if (!group) throw new NotFoundException("Group not found");

  if (group.admin.toString() !== userId.toString()) {
    throw new ForbiddenError("Only admins can update group media");
  }

  if (avatarMediaId) group.avatar = avatarMediaId;
  if (bannerMediaId) group.banner = bannerMediaId;

  await group.save();
  return group;
};

/* =====================================================
   JOIN GROUP
===================================================== */

export const joinGroupByInvite = async (joinCode, userId) => {
  const group = await groupDb.findGroupByJoinCode(joinCode);
  if (!group) throw new NotFoundException("Invalid invite link or group");

  const existing = await membershipService.findMembership({
    userId,
    groupId: group._id,
  });

  if (existing) {
    throw new ConflictException("You are already a member");
  }

  return membershipService.createMembership({
    userId,
    groupId: group._id,
    role: "member",
    status: "active",
  });
};

/* =====================================================
   LEAVE GROUP
===================================================== */

export const leaveGroup = async (userId, groupId) => {
  const membership = await membershipService.findMembership({
    userId,
    groupId,
  });

  if (!membership) {
    throw new NotFoundException("You are not a member");
  }

  if (membership.role === "admin") {
    throw new ForbiddenError(
      "Admin cannot leave without transferring ownership",
    );
  }

  await membershipService.removeMembership({ userId, groupId });
  return true;
};

/* =====================================================
   KICK MEMBER
===================================================== */

export const kickUserFromGroup = async ({ adminId, groupId, targetUserId }) => {
  const adminMembership = await membershipService.findMembership({
    userId: adminId,
    groupId,
  });

  if (!adminMembership || adminMembership.role !== "admin") {
    throw new ForbiddenError("Only admins can remove users");
  }

  const targetMembership = await membershipService.findMembership({
    userId: targetUserId,
    groupId,
  });

  if (!targetMembership) {
    throw new NotFoundException("Target user not found");
  }

  await membershipService.removeMembership({
    userId: targetUserId,
    groupId,
  });

  return true;
};

/* =====================================================
   CHANGE MEMBER ROLE
===================================================== */

export const changeMemberRole = async ({
  adminId,
  groupId,
  targetUserId,
  newRole,
}) => {
  const adminMembership = await membershipService.findMembership({
    userId: adminId,
    groupId,
  });

  if (!adminMembership || adminMembership.role !== "admin") {
    throw new ForbiddenError("Only admins can change roles");
  }

  const updated = await membershipService.updateMembership(
    { userId: targetUserId, groupId },
    { role: newRole },
  );

  if (!updated) {
    throw new BadRequestError("Failed to update role");
  }

  return updated;
};

/* =====================================================
   INVITE LINK
===================================================== */

export const generateInviteLink = async ({ adminId, groupId }) => {
  const adminMembership = await membershipService.findMembership({
    userId: adminId,
    groupId,
  });

  if (!adminMembership || adminMembership.role !== "admin") {
    throw new ForbiddenError("Only admins can generate invite links");
  }

  const inviteCode = await groupDb.createInviteCode(groupId);
  return `${configService.getBaseUrl()}/groups/join/${inviteCode}`;
};

/* =====================================================
   USER GROUPS WITH LAST MESSAGE
===================================================== */

export const getUserGroupsWithLastMessage = async ({
  userId,
  page = 1,
  limit = 20,
}) => {
  const skip = (page - 1) * limit;

  // 1️⃣ Fetch active memberships
  const memberships = await membershipCrud.findGroupsByUser(
    { userId, status: "active" },
    { skip, limit },
  );

  if (!memberships.length) return [];

  const groupIds = memberships.map((m) => m.groupId);

  // 2️⃣ Fetch groups with chatRoom populated
  const groups = await groupDb.findGroupsByIds(groupIds, {
    populateChatRoom: true,
  });

  // 3️⃣ Collect chatRoom IDs
  const chatRoomIds = groups.map((g) => g.chatRoom?._id).filter(Boolean);

  // 4️⃣ Fetch last messages
  const lastMessages = chatRoomIds.length
    ? await Message.aggregate([
        { $match: { chatRoom: { $in: chatRoomIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$chatRoom", message: { $first: "$$ROOT" } } },
      ])
    : [];

  const lastMessageMap = new Map(
    lastMessages.map((m) => [m._id.toString(), m.message]),
  );

  // 5️⃣ Assemble response
  return groups.map((group) => {
    const chatRoom = group.chatRoom || null;
    const lastMessage = chatRoom
      ? lastMessageMap.get(chatRoom._id.toString())
      : null;

    return {
      id: group._id,
      name: group.name,
      avatar: group.avatar,
      chatRoomId: chatRoom?._id || null,
      lastMessage: lastMessage
        ? {
            encryptedContent: lastMessage.encryptedContent,
            sender: lastMessage.sender,
            createdAt: lastMessage.createdAt,
          }
        : null,
      lastMessageAt: lastMessage?.createdAt || null,
    };
  });
};
