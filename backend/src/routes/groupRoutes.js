import { Router } from "express";
import {
  createGroup,
  getGroupByName,
  generateInviteLink,
  joinGroupByInvite,
  getGroupMembers,
  kickUserFromGroup,
  leaveGroup,
  changeMemberRole,
} from "../groupLogic/groupController.js";
import authMiddleware from "../middlewares/authenticationMdw.js";
import { requireGroupAdmin } from "../admin/adminMiddleware.js";

const router = Router();

// Create a group
router.post("/create", authMiddleware, createGroup);

// Get group by name
router.get("/name/:name", authMiddleware, getGroupByName);

// Generate invite link (admin only)
router.get(
  "/:groupId/invite",
  authMiddleware,
  requireGroupAdmin,
  generateInviteLink
);

// Join a group via invite link
router.post("/join/:joinCode", authMiddleware, joinGroupByInvite);

// View group members
router.get("/:groupId/members", authMiddleware, getGroupMembers);

// Kick a user from group (admin)
router.post(
  "/:groupId/kick/:userId",
  authMiddleware,
  requireGroupAdmin,
  kickUserFromGroup
);

// Leave group
router.post("/:groupId/leave", authMiddleware, leaveGroup);

// Change member role (admin)
router.post(
  "/:groupId/change-role/:userId",
  authMiddleware,
  requireGroupAdmin,
  changeMemberRole
);

export default router;
