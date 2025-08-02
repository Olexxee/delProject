import { Router } from "express";
import authMiddleware from "../middlewares/authenticationMdw.js";
import { requireGroupAdmin } from "../admin/adminMiddleware.js";
import {
  generateFixtures,
  getTournamentFixtures,
  getMatchdayFixtures,
  getTeamFixtures,
  regenerateFixtures,
  startTournament,
  getUpcomingFixtures,
} from "../tournamentLogic/fixtureController.js";

const fixtureRouter = Router();

// Generate fixtures (admin only)
fixtureRouter.post(
  "/:tournamentId/generate-fixtures",
  authMiddleware,
  requireGroupAdmin,
  generateFixtures
);

// Get all tournament fixtures
fixtureRouter.get(
  "/:tournamentId/fixtures",
  authMiddleware,
  getTournamentFixtures
);

// Get fixtures for specific matchday
fixtureRouter.get(
  "/:tournamentId/fixtures/matchday/:matchday",
  authMiddleware,
  getMatchdayFixtures
);

// Get team's fixtures in tournament
fixtureRouter.get(
  "/:tournamentId/fixtures/team/:teamId",
  authMiddleware,
  getTeamFixtures
);

// Regenerate fixtures (admin only)
fixtureRouter.post(
  "/:tournamentId/regenerate-fixtures",
  authMiddleware,
  requireGroupAdmin,
  regenerateFixtures
);

// Start tournament (admin only)
fixtureRouter.post(
  "/:tournamentId/start",
  authMiddleware,
  requireGroupAdmin,
  startTournament
);

// Get user's upcoming fixtures
fixtureRouter.get("/fixtures/upcoming", authMiddleware, getUpcomingFixtures);

export default fixtureRouter;
