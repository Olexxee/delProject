import UserStats from "./userStatSchema.js";
import { NotFoundException } from "../lib/classes/errorClasses.js";

/** CREATE or find existing stats entry */
export const getOrCreateStats = async (userId, tournamentId = null) => {
  let stats = await UserStats.findOne({ userId, tournamentId });
  if (!stats) {
    stats = await UserStats.create({ userId, tournamentId });
  }
  return stats;
};

/** UPDATE after a match */
export const updateUserStatsAfterMatch = async (userId, data) => {
  const stats = await getOrCreateStats(userId, data.tournamentId);

  // Apply results
  stats.matchesPlayed += 1;
  stats.goalsFor += data.goalsFor || 0;
  stats.goalsAgainst += data.goalsAgainst || 0;
  stats.goalDifference = stats.goalsFor - stats.goalsAgainst;

  switch (data.result) {
    case "win":
      stats.wins += 1;
      stats.points += data.pointsForWin || 3;
      stats.currentForm.push("W");
      break;
    case "loss":
      stats.losses += 1;
      stats.points += data.pointsForLoss || 0;
      stats.currentForm.push("L");
      break;
    case "draw":
      stats.draws += 1;
      stats.points += data.pointsForDraw || 1;
      stats.currentForm.push("D");
      break;
  }

  // Keep only last 5 results
  if (stats.currentForm.length > 5) {
    stats.currentForm = stats.currentForm.slice(-5);
  }

  stats.lastUpdated = new Date();
  await stats.save();

  return stats;
};

/** FETCH player stats */
export const getPlayerStats = async (userId, tournamentId = null) => {
  const stats = await UserStats.findOne({ userId, tournamentId })
    .populate("userId", "username avatar")
    .populate("tournamentId", "name type");
  if (!stats) throw new NotFoundException("Player stats not found");
  return stats;
};

/** RESET player stats (admin utility) */
export const resetPlayerStats = async (userId, tournamentId = null) => {
  const stats = await UserStats.findOneAndUpdate(
    { userId, tournamentId },
    {
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      currentForm: [],
    },
    { new: true }
  );
  return stats;
};

/** DELETE player stats */
export const deletePlayerStats = async (userId, tournamentId = null) => {
  await UserStats.findOneAndDelete({ userId, tournamentId });
  return { message: "Stats deleted successfully" };
};
