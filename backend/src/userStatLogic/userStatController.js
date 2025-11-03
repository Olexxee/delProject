import * as userStatsService from "./userStatService.js";
import { asyncWrapper } from "../lib/utils.js";

export const getPlayerStats = asyncWrapper(async (req, res) => {
  const { userId } = req.params;
  const { tournamentId } = req.query;
  const stats = await userStatsService.getPlayerStats(userId, tournamentId);
  res.status(200).json({ success: true, data: stats });
});

export const resetStats = asyncWrapper(async (req, res) => {
  const { userId } = req.params;
  const { tournamentId } = req.query;
  const stats = await userStatsService.resetPlayerStats(userId, tournamentId);
  res.status(200).json({ success: true, message: "Stats reset", data: stats });
});

export const deleteStats = asyncWrapper(async (req, res) => {
  const { userId } = req.params;
  const { tournamentId } = req.query;
  const result = await userStatsService.deletePlayerStats(userId, tournamentId);
  res.status(200).json(result);
});
