import { Router } from "express";
import {
  createTournament,
  getTournament,
  getGroupTournaments,
  updateTournament,
  cancelTournament,
} from "../tournaments/tournamentController.js";
import authMiddleware from "../middlewares/authenticationMdw.js";
import { requireGroupAdmin } from "../admin/adminMiddleware.js";

const tournamentRouter = Router();

// Create tournament (group admin only)
tournamentRouter.post(
  "/group/:groupId/create",
  authMiddleware,
  requireGroupAdmin,
  createTournament
);

// Get tournament details
tournamentRouter.get("/:tournamentId", authMiddleware, getTournament);

// Get all tournaments for a group
tournamentRouter.get("/group/:groupId", authMiddleware, getGroupTournaments);

// Update tournament (group admin only)
tournamentRouter.patch(
  "/:tournamentId",
  authMiddleware,
  requireGroupAdmin,
  updateTournament
);

// Cancel tournament (group admin only)
tournamentRouter.delete(
  "/:tournamentId",
  authMiddleware,
  requireGroupAdmin,
  cancelTournament
);

export default tournamentRouter;
