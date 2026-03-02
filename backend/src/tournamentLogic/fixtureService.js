import mongoose from "mongoose";
import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import { updateGroupMetrics } from "../groupLogic/groupMetric.js";
import {
  NotFoundException,
  BadRequestError,
  ConflictException,
} from "../lib/classes/errorClasses.js";

/**
 * MARK FIXTURE AS COMPLETED AND UPDATE STATS
 */
export const completeFixture = async ({ fixtureId, results }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const fixture = await fixtureDb.findFixtureById(fixtureId);
    if (!fixture) throw new NotFoundException("Fixture not found");

    const tournament = await tournamentDb.findTournamentById(
      fixture.tournamentId,
    );
    if (!tournament) throw new NotFoundException("Tournament not found");

    // Update fixture with results
    const updatedFixture = await fixtureDb.updateFixture(
      fixtureId,
      {
        homeGoals: results.homeGoals,
        awayGoals: results.awayGoals,
        isCompleted: true,
        completedAt: new Date(),
        participants: results.participants, // array of { userId, goals, isWinner }
      },
      { session },
    );

    // Update participant stats in tournament
    await userStatsService.updateParticipantStats({
      matchId: fixtureId,
      tournamentId: fixture.tournamentId,
      participants: results.participants,
      matchday: fixture.matchday,
      scheduledDate: fixture.scheduledDate,
    });

    // Recalculate league table (optional: can store historical tables)
    await leagueService.generateLeagueTable(fixture.tournamentId);

    // Update group metrics
    await updateGroupMetrics(
      tournament.groupId._id || tournament.groupId,
      session,
    );

    await session.commitTransaction();
    session.endSession();

    return {
      message: "Fixture completed and stats updated successfully",
      fixture: updatedFixture,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// -------------------------------
// GENERATE TOURNAMENT FIXTURES
// -------------------------------
export const generateTournamentFixtures = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) throw new NotFoundException("Tournament not found");

    // Admin check
    await membershipService.assertIsAdmin({
      userId,
      groupId: tournament.groupId._id || tournament.groupId,
    });

    if (tournament.currentParticipants < 4) {
      throw new BadRequestError(
        "Tournament needs at least 4 participants to generate fixtures",
      );
    }

    const existingFixtures = await fixtureDb.fixturesExist(tournamentId);
    if (existingFixtures) {
      throw new ConflictException("Fixtures already generated");
    }

    if (tournament.status !== "registration") {
      throw new BadRequestError(
        "Can only generate fixtures during registration phase",
      );
    }

    // Get active participants
    const activeParticipants = tournament.participants
      .filter((p) => p.status === "registered")
      .map((p) => p.userId._id || p.userId);

    if (activeParticipants.length < 4) {
      throw new BadRequestError(
        "Not enough active participants to generate fixtures",
      );
    }

    // Generate fixtures
    const fixtures =
      tournament.settings.rounds === "double"
        ? generateDoubleRoundRobinFixtures(activeParticipants, tournamentId)
        : generateSingleRoundRobinFixtures(activeParticipants, tournamentId);

    // Save fixtures
    const createdFixtures = await fixtureDb.createFixtures(fixtures, {
      session,
    });

    // Update tournament metadata
    await tournamentDb.updateTournament(
      tournamentId,
      {
        status: "upcoming",
        totalMatchdays: Math.max(...fixtures.map((f) => f.matchday)),
        currentMatchday: 1,
      },
      { session },
    );

    // Update group metrics
    await updateGroupMetrics(
      tournament.groupId._id || tournament.groupId,
      session,
    );

    await session.commitTransaction();
    session.endSession();

    return {
      message: "Fixtures generated successfully",
      fixturesCount: createdFixtures.length,
      totalMatchdays: Math.max(...fixtures.map((f) => f.matchday)),
      fixtures: createdFixtures,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// -------------------------------
// REGENERATE FIXTURES (ADMIN ONLY)
// -------------------------------
export const regenerateFixtures = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) throw new NotFoundException("Tournament not found");

    // Admin check
    await membershipService.assertIsAdmin({
      userId,
      groupId: tournament.groupId._id || tournament.groupId,
    });

    if (tournament.status === "ongoing") {
      throw new BadRequestError(
        "Cannot regenerate fixtures for ongoing tournament",
      );
    }

    // Delete existing fixtures
    await fixtureDb.deleteAllFixtures(tournamentId, { session });

    // Reset tournament
    await tournamentDb.updateTournament(
      tournamentId,
      {
        status: "registration",
        currentMatchday: 0,
        totalMatchdays: 0,
      },
      { session },
    );

    // Generate new fixtures
    const result = await generateTournamentFixtures({ tournamentId, userId });

    await session.commitTransaction();
    session.endSession();

    return result;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// -------------------------------
// HELPER: ROUND-ROBIN FIXTURES
// -------------------------------
const generateSingleRoundRobinFixtures = (participants, tournamentId) => {
  const fixtures = [];
  const n = participants.length;
  let matchday = 1;

  const extendedParticipants =
    n % 2 === 0 ? participants : [...participants, null];
  const totalRounds = extendedParticipants.length - 1;

  for (let round = 0; round < totalRounds; round++) {
    for (let match = 0; match < extendedParticipants.length / 2; match++) {
      const home = (round + match) % totalRounds;
      const away = (totalRounds - match + round) % totalRounds;

      const homeTeam =
        home === totalRounds
          ? extendedParticipants[totalRounds]
          : extendedParticipants[home];
      const awayTeam =
        away === totalRounds
          ? extendedParticipants[totalRounds]
          : extendedParticipants[away];

      if (homeTeam && awayTeam && homeTeam !== awayTeam) {
        fixtures.push({ tournamentId, matchday, homeTeam, awayTeam });
      }
    }
    matchday++;
  }

  return fixtures;
};

const generateDoubleRoundRobinFixtures = (participants, tournamentId) => {
  const firstRound = generateSingleRoundRobinFixtures(
    participants,
    tournamentId,
  );
  const maxMatchday = Math.max(...firstRound.map((f) => f.matchday));

  const secondRound = firstRound.map((f) => ({
    ...f,
    matchday: f.matchday + maxMatchday,
    homeTeam: f.awayTeam,
    awayTeam: f.homeTeam,
  }));

  return [...firstRound, ...secondRound];
};
// ================================
// FIXTURE QUERIES
// ================================
export const getTournamentFixtures = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const fixtures = await fixtureDb.getTournamentFixtures(tournamentId);

  return {
    tournament: {
      id: tournament._id,
      name: tournament.name,
      status: tournament.status,
      currentMatchday: tournament.currentMatchday,
      totalMatchdays: tournament.totalMatchdays,
    },
    fixturesCount: fixtures.length,
    fixtures,
  };
};

export const getMatchdayFixtures = async ({ tournamentId, matchday }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const fixtures = await fixtureDb.getMatchdayFixtures(tournamentId, matchday);
  const stats = await fixtureDb.getMatchdayStats(tournamentId, matchday);

  return {
    tournament: { id: tournament._id, name: tournament.name },
    matchday,
    fixtures,
    stats,
  };
};

export const getTeamFixtures = async ({ tournamentId, teamId }) => {
  const fixtures = await fixtureDb.getTeamFixtures(tournamentId, teamId);

  return {
    teamId,
    fixtures: fixtures.map((f) => ({
      ...f.toObject(),
      isHome: f.homeTeam._id.toString() === teamId.toString(),
      opponent:
        f.homeTeam._id.toString() === teamId.toString()
          ? f.awayTeam
          : f.homeTeam,
    })),
  };
};

// ================================
// ADMIN OPERATIONS
// ================================

export const startTournament = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  const fixturesExist = await fixtureDb.fixturesExist(tournamentId);
  if (!fixturesExist)
    throw new BadRequestError("Generate fixtures before starting tournament");

  await tournamentDb.updateTournament(tournamentId, {
    status: "ongoing",
    startDate: new Date(),
  });

  // Update group metrics for active tournaments
  await updateGroupMetrics(tournament.groupId);

  return { message: "Tournament started successfully", status: "ongoing" };
};
