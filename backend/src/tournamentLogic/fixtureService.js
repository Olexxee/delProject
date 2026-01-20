import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import {
  NotFoundException,
  BadRequestError,
  ConflictException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";

// ================================
// TOURNAMENT FIXTURE GENERATION
// ================================
export const generateTournamentFixtures = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  // Ensure user is group admin
  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  // Minimum participants check
  if (tournament.currentParticipants < 4) {
    throw new BadRequestError(
      "Tournament needs at least 4 participants to generate fixtures"
    );
  }

  // Check if fixtures already exist
  const existingFixtures = await fixtureDb.fixturesExist(tournamentId);
  if (existingFixtures) {
    throw new ConflictException(
      "Fixtures have already been generated for this tournament"
    );
  }

  // Tournament phase check
  if (tournament.status !== "registration") {
    throw new BadRequestError(
      "Can only generate fixtures for tournaments in registration phase"
    );
  }

  // Get active participants
  const activeParticipants = tournament.participants
    .filter((p) => p.status === "registered")
    .map((p) => p.userId._id || p.userId);

  if (activeParticipants.length < 4) {
    throw new BadRequestError(
      "Not enough active participants to generate fixtures"
    );
  }

  // Generate fixtures
  const fixtures =
    tournament.settings.rounds === "double"
      ? generateDoubleRoundRobinFixtures(activeParticipants, tournamentId)
      : generateSingleRoundRobinFixtures(activeParticipants, tournamentId);

  // Save to DB
  const createdFixtures = await fixtureDb.createFixtures(fixtures);

  // Update tournament metadata
  await tournamentDb.updateTournament(tournamentId, {
    status: "upcoming",
    totalMatchdays: Math.max(...fixtures.map((f) => f.matchday)),
    currentMatchday: 1,
  });

  return {
    message: "Fixtures generated successfully",
    fixturesCount: createdFixtures.length,
    totalMatchdays: Math.max(...fixtures.map((f) => f.matchday)),
    fixtures: createdFixtures,
  };
};

// ================================
// FIXTURE GENERATION ALGORITHMS
// ================================
const generateSingleRoundRobinFixtures = (participants, tournamentId) => {
  const fixtures = [];
  const n = participants.length;
  let matchday = 1;

  if (n % 2 === 0) {
    // Even participants
    for (let round = 0; round < n - 1; round++) {
      const roundFixtures = [];
      for (let match = 0; match < n / 2; match++) {
        const home = (round + match) % (n - 1);
        const away = (n - 1 - match + round) % (n - 1);

        const homeTeam = home === n - 1 ? participants[n - 1] : participants[home];
        const awayTeam = away === n - 1 ? participants[n - 1] : participants[away];

        if (homeTeam !== awayTeam) {
          roundFixtures.push({ tournamentId, matchday, homeTeam, awayTeam });
        }
      }
      fixtures.push(...roundFixtures);
      matchday++;
    }
  } else {
    // Odd participants (add bye)
    const extendedParticipants = [...participants, null];
    const extendedN = extendedParticipants.length;

    for (let round = 0; round < extendedN - 1; round++) {
      const roundFixtures = [];
      for (let match = 0; match < extendedN / 2; match++) {
        const home = (round + match) % (extendedN - 1);
        const away = (extendedN - 1 - match + round) % (extendedN - 1);

        const homeTeam = home === extendedN - 1 ? extendedParticipants[extendedN - 1] : extendedParticipants[home];
        const awayTeam = away === extendedN - 1 ? extendedParticipants[extendedN - 1] : extendedParticipants[away];

        if (homeTeam && awayTeam && homeTeam !== awayTeam) {
          roundFixtures.push({ tournamentId, matchday, homeTeam, awayTeam });
        }
      }
      fixtures.push(...roundFixtures);
      matchday++;
    }
  }

  return fixtures;
};

const generateDoubleRoundRobinFixtures = (participants, tournamentId) => {
  const firstRound = generateSingleRoundRobinFixtures(participants, tournamentId);
  const maxMatchday = Math.max(...firstRound.map((f) => f.matchday));

  const secondRound = firstRound.map((fixture) => ({
    ...fixture,
    matchday: fixture.matchday + maxMatchday,
    homeTeam: fixture.awayTeam,
    awayTeam: fixture.homeTeam,
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
    fixtures: fixtures.map((fixture) => ({
      ...fixture.toObject(),
      isHome: fixture.homeTeam._id.toString() === teamId.toString(),
      opponent:
        fixture.homeTeam._id.toString() === teamId.toString()
          ? fixture.awayTeam
          : fixture.homeTeam,
    })),
  };
};

// ================================
// ADMIN OPERATIONS
// ================================
export const regenerateFixtures = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  if (tournament.status === "ongoing") {
    throw new BadRequestError("Cannot regenerate fixtures for ongoing tournament");
  }

  await fixtureDb.deleteAllFixtures(tournamentId);

  await tournamentDb.updateTournament(tournamentId, {
    status: "registration",
    currentMatchday: 0,
    totalMatchdays: 0,
  });

  return await generateTournamentFixtures({ tournamentId, userId });
};

export const startTournament = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  const fixturesExist = await fixtureDb.fixturesExist(tournamentId);
  if (!fixturesExist) throw new BadRequestError("Generate fixtures before starting tournament");

  await tournamentDb.updateTournament(tournamentId, {
    status: "ongoing",
    startDate: new Date(),
  });

  return { message: "Tournament started successfully", status: "ongoing" };
};
