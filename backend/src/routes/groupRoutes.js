import { Router } from "express";
import {
  createGroup,
  getGroupByName,
  generateInviteLink,
  joinGroupByInvite,
  // getGroupMembers,
  getMyGroups,
  kickUserFromGroup,
  leaveGroup,
  changeMemberRole,
  updateGroupMedia, // <-- new endpoint
} from "../groupLogic/groupController.js";
import {authMiddleware} from "../middlewares/authenticationMdw.js";
import { requireGroupAdmin } from "../admin/adminMiddleware.js";
import { handleMediaUpload } from "../middlewares/uploadMiddleware.js";

const groupRouter = Router();

// -----------------------
// GROUP ROUTES
// -----------------------

// Create a group
groupRouter.post("/create", authMiddleware, createGroup);

// Get group by name
groupRouter.get("/name/:name", authMiddleware, getGroupByName);

// Generate invite link (admin only)
groupRouter.get(
  "/:groupId/invite",
  authMiddleware,
  requireGroupAdmin,
  generateInviteLink
);

// Join a group via invite link
groupRouter.post("/join/:joinCode", authMiddleware, joinGroupByInvite);

// View group members
// groupRouter.get("/:groupId/members", authMiddleware, getGroupMembers);

// Kick a user from group (admin)
groupRouter.post(
  "/:groupId/kick/:userId",
  authMiddleware,
  requireGroupAdmin,
  kickUserFromGroup
);

// Leave group
groupRouter.post("/:groupId/leave", authMiddleware, leaveGroup);

// Change member role (admin)
groupRouter.post(
  "/:groupId/change-role/:userId",
  authMiddleware,
  requireGroupAdmin,
  changeMemberRole
);

// Get all groups of the user
groupRouter.get("/my-groups", authMiddleware, getMyGroups);

// -----------------------
// UPLOAD GROUP MEDIA
// -----------------------
// Only 1 avatar or banner allowed per upload
groupRouter.post(
  "/:groupId/media",
  authMiddleware,
  requireGroupAdmin,
  handleMediaUpload("group"), // you can also create separate type "group" if needed
  updateGroupMedia
);

export default groupRouter;
