import { Router } from "express";
import authMiddleware from "../middlewares/authenticationMdw.js";
import {
  getLeagueTable,
  getMiniTable,
  getHeadToHead,
  getTeamPosition,
  getHistoricalTable,
  getLiveTable,
} from "../tournamentLogic/leagueTableController.js";

const tabRouter = Router();

// Get full league table
tabRouter.get("/:tournamentId/table", authMiddleware, getLeagueTable);

// Get mini table (top/bottom teams)
tabRouter.get("/:tournamentId/table/mini", authMiddleware, getMiniTable);

// Get live table with real-time updates
tabRouter.get("/:tournamentId/table/live", authMiddleware, getLiveTable);

// Get historical table for specific matchday
tabRouter.get(
  "/:tournamentId/table/matchday/:matchday",
  authMiddleware,
  getHistoricalTable
);

// Get head-to-head record between two teams
tabRouter.get(
  "/:tournamentId/h2h/:team1Id/:team2Id",
  authMiddleware,
  getHeadToHead
);

// Get team's position and nearby teams
tabRouter.get(
  "/:tournamentId/table/team/:teamId",
  authMiddleware,
  getTeamPosition
);

export default tabRouter;
