import { Router } from "express";
import {
  createTournament,
  getTournament,
  getGroupTournaments,
  updateTournament,
  cancelTournament,
  checkTournamentReadiness,
  startTournament,
  getTournamentTable,
} from "../tournamentLogic/tournamentController.js";
import authMiddleware from "../middlewares/authenticationMdw.js";
import { requireGroupAdmin } from "../admin/adminMiddleware.js";

const tournamentRouter = Router();

// --------------------
// TOURNAMENT CRUD
// --------------------

// Create tournament (group admin only)
tournamentRouter.post(
  "/group/:groupId/create",
  authMiddleware,
  requireGroupAdmin,
  createTournament
);

// Get tournament details (includes fixture summary)
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

// --------------------
// TOURNAMENT OPERATIONS
// --------------------

// Check readiness (any authenticated user)
tournamentRouter.get(
  "/:tournamentId/readiness",
  authMiddleware,
  checkTournamentReadiness
);

// Start tournament (group admin only)
tournamentRouter.post(
  "/:tournamentId/start",
  authMiddleware,
  requireGroupAdmin,
  startTournament
);

// Get league table / tournament stats
tournamentRouter.get(
  "/:tournamentId/table",
  authMiddleware,
  getTournamentTable
);

export default tournamentRouter;
