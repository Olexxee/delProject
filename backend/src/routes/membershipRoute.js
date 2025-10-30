import { Router } from "express";
import authMiddleware from "../middlewares/authenticationMdw.js";
import {
  requireGroupAdmin,
  requirePlatformGroupAdmin,
} from "../admin/adminMiddleware.js";
import {
  joinGroup,
  leaveGroup,
  getGroupMembers,
  getUserGroups,
  updateMembership,
  banUser,
  toggleMemberMute,
} from "../groupLogic/membershipController.js";

const membershipRouter = Router();

/* ---------------------------------------------------------
   👥 1️⃣ Fetch all groups the logged-in user belongs to
--------------------------------------------------------- */
membershipRouter.get("/my-groups", authMiddleware, getUserGroups);

/* ---------------------------------------------------------
   ➕ 2️⃣ Join a group
--------------------------------------------------------- */
membershipRouter.post("/:groupId/join", authMiddleware, joinGroup);

/* ---------------------------------------------------------
   🚪 3️⃣ Leave a group
--------------------------------------------------------- */
membershipRouter.post("/:groupId/leave", authMiddleware, leaveGroup);

/* ---------------------------------------------------------
   🧩 4️⃣ Get all members in a group
--------------------------------------------------------- */
membershipRouter.get(
  "/:groupId/members",
  authMiddleware,
  requireGroupAdmin,
  getGroupMembers
);

/* ---------------------------------------------------------
   ⚙️ 5️⃣ Update membership (role, mute, status)
--------------------------------------------------------- */
membershipRouter.patch(
  "/:groupId/membership/:userId",
  authMiddleware,
  requireGroupAdmin,
  updateMembership
);

/* ---------------------------------------------------------
   🔇 6️⃣ Toggle mute/unmute notifications for current user
--------------------------------------------------------- */
membershipRouter.patch(
  "/:groupId/mute",
  authMiddleware,
  toggleMemberMute // user can mute/unmute themselves in a group
);

/* ---------------------------------------------------------
   🚫 7️⃣ Ban a user (admin only)
--------------------------------------------------------- */
membershipRouter.post(
  "/:groupId/ban/:userId",
  authMiddleware,
  requireGroupAdmin,
  banUser
);

export default membershipRouter;
