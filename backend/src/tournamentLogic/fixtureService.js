import mongoose from "mongoose";
import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as userStatsService from "../user/statschemaService.js";
import * as leagueService from "./leagueTableService.js";
import { updateGroupMetrics } from "../groupLogic/groupMetric.js";
import cache from "../lib/cache.js";
import {
  NotFoundException,
  BadRequestError,
  ConflictException,
} from "../lib/classes/errorClasses.js";

// ================================
// COMPLETE FIXTURE & UPDATE STATS
// ================================
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

    // Update participant stats
    await userStatsService.updateParticipantStats({
      matchId: fixtureId,
      tournamentId: fixture.tournamentId,
      participants: results.participants,
      matchday: fixture.matchday,
      scheduledDate: fixture.scheduledDate,
    });

    // Recalculate league table — invalidates its own cache key internally
    await leagueService.generateLeagueTable(fixture.tournamentId);

    // Invalidate remaining cache after table is refreshed
    await cache.deleteByPattern(`tournament:${fixture.tournamentId}:*`);
    await cache.deleteByPattern(`user:*:upcoming-fixtures`);

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

// ================================
// GENERATE TOURNAMENT FIXTURES
// ================================
export const generateTournamentFixtures = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) throw new NotFoundException("Tournament not found");

    await membershipService.assertIsAdmin({
      userId,
      groupId: tournament.groupId._id || tournament.groupId,
    });

    if (tournament.status !== "registration") {
      throw new BadRequestError(
        "Can only generate fixtures during registration phase",
      );
    }

    const existingFixtures = await fixtureDb.fixturesExist(tournamentId);
    if (existingFixtures) {
      throw new ConflictException("Fixtures already generated");
    }

    const activeParticipants = tournament.participants
      .filter((p) => p.status === "registered")
      .map((p) => p.userId._id || p.userId);

    if (activeParticipants.length < 4) {
      throw new BadRequestError(
        "Tournament needs at least 4 participants to generate fixtures",
      );
    }

    const fixtures =
      tournament.settings.rounds === "double"
        ? generateDoubleRoundRobinFixtures(activeParticipants, tournamentId)
        : generateSingleRoundRobinFixtures(activeParticipants, tournamentId);

    const createdFixtures = await fixtureDb.createFixtures(fixtures, {
      session,
    });
    const totalMatchdays = Math.max(...fixtures.map((f) => f.matchday));

    await tournamentDb.updateTournament(
      tournamentId,
      {
        status: "upcoming",
        totalMatchdays,
        currentMatchday: 1,
      },
      { session },
    );

    await updateGroupMetrics(
      tournament.groupId._id || tournament.groupId,
      session,
    );

    await session.commitTransaction();
    session.endSession();

    await cache.deleteByPattern(`tournament:${tournamentId}:*`);

    return {
      message: "Fixtures generated successfully",
      fixturesCount: createdFixtures.length,
      totalMatchdays,
      fixtures: createdFixtures,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// ================================
// REGENERATE FIXTURES (ADMIN ONLY)
// ================================
export const regenerateFixtures = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) throw new NotFoundException("Tournament not found");

    await membershipService.assertIsAdmin({
      userId,
      groupId: tournament.groupId._id || tournament.groupId,
    });

    if (tournament.status === "ongoing") {
      throw new BadRequestError(
        "Cannot regenerate fixtures for an ongoing tournament",
      );
    }

    await fixtureDb.deleteAllFixtures(tournamentId, { session });

    await tournamentDb.updateTournament(
      tournamentId,
      {
        status: "registration",
        currentMatchday: 0,
        totalMatchdays: 0,
      },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    // Run outside the original session — generateTournamentFixtures opens its own
    const result = await generateTournamentFixtures({ tournamentId, userId });
    return result;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
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

  const [fixtures, stats] = await Promise.all([
    fixtureDb.getMatchdayFixtures(tournamentId, matchday),
    fixtureDb.getMatchdayStats(tournamentId, matchday),
  ]);

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
// START TOURNAMENT (ADMIN ONLY)
// ================================
export const startTournament = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) throw new NotFoundException("Tournament not found");

    await membershipService.assertIsAdmin({
      userId,
      groupId: tournament.groupId._id || tournament.groupId,
    });

    const fixturesExist = await fixtureDb.fixturesExist(tournamentId);
    if (!fixturesExist) {
      throw new BadRequestError(
        "Generate fixtures before starting the tournament",
      );
    }

    await tournamentDb.updateTournament(
      tournamentId,
      {
        status: "ongoing",
        startDate: new Date(),
        currentMatchday: 1,
      },
      { session },
    );

    await updateGroupMetrics(
      tournament.groupId._id || tournament.groupId,
      session,
    );

    await session.commitTransaction();
    session.endSession();

    await cache.deleteByPattern(`tournament:${tournamentId}:*`);

    return { message: "Tournament started successfully", status: "ongoing" };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// ================================
// HELPERS: ROUND-ROBIN GENERATION
// ================================
const generateSingleRoundRobinFixtures = (participants, tournamentId) => {
  const fixtures = [];
  const n = participants.length;
  const extendedParticipants =
    n % 2 === 0 ? participants : [...participants, null];
  const totalRounds = extendedParticipants.length - 1;
  let matchday = 1;

  for (let round = 0; round < totalRounds; round++) {
    for (let match = 0; match < extendedParticipants.length / 2; match++) {
      const homeIdx = (round + match) % totalRounds;
      const awayIdx = (totalRounds - match + round) % totalRounds;

      const homeTeam =
        homeIdx === totalRounds
          ? extendedParticipants[totalRounds]
          : extendedParticipants[homeIdx];
      const awayTeam =
        awayIdx === totalRounds
          ? extendedParticipants[totalRounds]
          : extendedParticipants[awayIdx];

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
