import * as fixtureService from "./fixtureService.js";
import { asyncWrapper } from "../lib/utils.js";
import {
  ValidationException,
  NotFoundException,
} from "../lib/classes/errorClasses.js";

// Generate fixtures for tournament
export const generateFixtures = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const result = await fixtureService.generateTournamentFixtures({
    tournamentId,
    userId,
  });

  res.status(201).json({
    success: true,
    ...result,
  });
});

// Get all tournament fixtures
export const getTournamentFixtures = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  const result = await fixtureService.getTournamentFixtures(tournamentId);

  res.status(200).json({
    success: true,
    ...result,
  });
});

// Get fixtures for specific matchday
export const getMatchdayFixtures = asyncWrapper(async (req, res) => {
  const { tournamentId, matchday } = req.params;

  const result = await fixtureService.getMatchdayFixtures({
    tournamentId,
    matchday: parseInt(matchday),
  });

  res.status(200).json({
    success: true,
    ...result,
  });
});

// Get team's fixtures
export const getTeamFixtures = asyncWrapper(async (req, res) => {
  const { tournamentId, teamId } = req.params;

  const result = await fixtureService.getTeamFixtures({
    tournamentId,
    teamId,
  });

  res.status(200).json({
    success: true,
    ...result,
  });
});

// Regenerate fixtures
export const regenerateFixtures = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const result = await fixtureService.regenerateFixtures({
    tournamentId,
    userId,
  });

  res.status(200).json({
    success: true,
    message: "Fixtures regenerated successfully",
    ...result,
  });
});

// Start tournament
export const startTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const result = await fixtureService.startTournament({
    tournamentId,
    userId,
  });

  res.status(200).json({
    success: true,
    ...result,
  });
});

// Get upcoming fixtures across all tournaments for user
export const getUpcomingFixtures = asyncWrapper(async (req, res) => {
  const userId = req.user._id;

  // This would require additional service method to get user's upcoming fixtures
  // across all tournaments they're participating in

  res.status(200).json({
    success: true,
    message: "Feature coming soon",
  });
});
