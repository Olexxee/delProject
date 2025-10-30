import { Router } from "express";
import authMiddleware from "../middlewares/authenticationMdw.js";
import { requireGroupAdmin } from "../admin/adminMiddleware.js";
import {
  createGroup,
  getGroupByName,
  generateInviteLink,
  joinGroupByInvite,
  getGroupMembers,
  leaveGroup,
  kickUserFromGroup,
  changeMemberRole,
  toggleGroupMute,
  toggleMemberMute,
} from "../groupLogic/groupController.js";

const router = Router();

/* ========================================================
   🏗️ GROUP CREATION & DISCOVERY
======================================================== */

// Create a new group (with chat context)
router.post("/create", authMiddleware, createGroup);

// Get group by name
router.get("/name/:name", authMiddleware, getGroupByName);

/* ========================================================
   🔗 INVITE & JOIN
======================================================== */

// Generate an invite link (Group Admin only)
router.get(
  "/:groupId/invite",
  authMiddleware,
  requireGroupAdmin,
  generateInviteLink
);

// Join group via invite link
router.post("/join/:joinCode", authMiddleware, joinGroupByInvite);

/* ========================================================
   👥 MEMBERSHIP MANAGEMENT
======================================================== */

// Get all group members
router.get("/:groupId/members", authMiddleware, getGroupMembers);

// Leave a group
router.post("/:groupId/leave", authMiddleware, leaveGroup);

// Kick a user from a group (Admin only)
router.post(
  "/:groupId/kick/:userId",
  authMiddleware,
  requireGroupAdmin,
  kickUserFromGroup
);

// Change a member’s role (Admin only)
router.post(
  "/:groupId/change-role/:userId",
  authMiddleware,
  requireGroupAdmin,
  changeMemberRole
);

/* ========================================================
   🔇 MUTE CONTROLS
======================================================== */

// Toggle mute/unmute for the entire group (Admin only)
router.patch(
  "/:groupId/toggle-mute",
  authMiddleware,
  requireGroupAdmin,
  toggleGroupMute
);

// Toggle mute/unmute for a member’s own notifications
router.patch(
  "/:groupId/membership/toggle-mute",
  authMiddleware,
  toggleMemberMute
);

export default router;
