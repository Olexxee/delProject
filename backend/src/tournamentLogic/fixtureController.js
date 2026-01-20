import * as fixtureService from "../services/fixtureService.js";
import { asyncWrapper } from "../lib/utils.js";
import {
  ValidationException,
  NotFoundException,
  BadRequestError,
} from "../lib/classes/errorClasses.js";

// -------------------------------
// GENERATE FIXTURES FOR TOURNAMENT
// -------------------------------
export const generateFixtures = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const result = await fixtureService.generateTournamentFixtures({
    tournamentId,
    userId,
  });

  res.status(201).json({
    success: true,
    message: "Fixtures generated successfully",
    ...result,
  });
});

// -------------------------------
// GET ALL TOURNAMENT FIXTURES
// -------------------------------
export const getTournamentFixtures = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  const fixtures = await fixtureService.getTournamentFixtures(tournamentId);

  res.status(200).json({
    success: true,
    tournamentId,
    fixturesCount: fixtures.length,
    fixtures,
  });
});

// -------------------------------
// GET MATCHDAY FIXTURES
// -------------------------------
export const getMatchdayFixtures = asyncWrapper(async (req, res) => {
  const { tournamentId, matchday } = req.params;

  const fixtures = await fixtureService.getMatchdayFixtures({
    tournamentId,
    matchday: parseInt(matchday),
  });

  res.status(200).json({
    success: true,
    tournamentId,
    matchday: parseInt(matchday),
    fixturesCount: fixtures.length,
    fixtures,
  });
});

// -------------------------------
// GET TEAM FIXTURES
// -------------------------------
export const getTeamFixtures = asyncWrapper(async (req, res) => {
  const { tournamentId, teamId } = req.params;

  const fixtures = await fixtureService.getTeamFixtures({
    tournamentId,
    teamId,
  });

  res.status(200).json({
    success: true,
    tournamentId,
    teamId,
    fixturesCount: fixtures.length,
    fixtures,
  });
});

// -------------------------------
// GET UPCOMING FIXTURES FOR LOGGED-IN USER
// -------------------------------
export const getUpcomingFixtures = asyncWrapper(async (req, res) => {
  const userId = req.user._id;

  const fixtures = await fixtureService.getUpcomingFixturesForUser(userId);

  res.status(200).json({
    success: true,
    upcomingCount: fixtures.length,
    fixtures,
  });
});

// -------------------------------
// REGENERATE FIXTURES (ADMIN ONLY)
// -------------------------------
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

// -------------------------------
// START TOURNAMENT (ADMIN ONLY)
// -------------------------------
export const startTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const result = await fixtureService.startTournament({
    tournamentId,
    userId,
  });

  res.status(200).json({
    success: true,
    message: "Tournament started successfully",
    ...result,
  });
});
