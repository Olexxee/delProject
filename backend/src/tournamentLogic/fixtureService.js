import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "./tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import {
  NotFoundException,
  BadRequestError,
  ConflictException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";

// Generate fixtures for tournament
export const generateTournamentFixtures = async ({ tournamentId, userId }) => {
  // Get tournament details
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Check if user is group admin
  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  // Check if tournament has enough participants
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

  // Check tournament status
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

  // Generate fixtures based on tournament type
  let fixtures;
  if (tournament.settings.rounds === "double") {
    fixtures = generateDoubleRoundRobinFixtures(
      activeParticipants,
      tournamentId
    );
  } else {
    fixtures = generateSingleRoundRobinFixtures(
      activeParticipants,
      tournamentId
    );
  }

  // Save fixtures to database
  const createdFixtures = await fixtureDb.createFixtures(fixtures);

  // Update tournament status and matchday info
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

// Single Round-Robin Algorithm
const generateSingleRoundRobinFixtures = (participants, tournamentId) => {
  const fixtures = [];
  const n = participants.length;
  let matchday = 1;

  // Handle even number of participants
  if (n % 2 === 0) {
    for (let round = 0; round < n - 1; round++) {
      const roundFixtures = [];

      for (let match = 0; match < n / 2; match++) {
        const home = (round + match) % (n - 1);
        const away = (n - 1 - match + round) % (n - 1);

        // Last team stays fixed
        const homeTeam =
          home === n - 1 ? participants[n - 1] : participants[home];
        const awayTeam =
          away === n - 1 ? participants[n - 1] : participants[away];

        if (homeTeam !== awayTeam) {
          roundFixtures.push({
            tournamentId,
            matchday,
            homeTeam,
            awayTeam,
          });
        }
      }

      fixtures.push(...roundFixtures);
      matchday++;
    }
  } else {
    // Handle odd number - add dummy team
    const extendedParticipants = [...participants, null];
    const extendedN = extendedParticipants.length;

    for (let round = 0; round < extendedN - 1; round++) {
      const roundFixtures = [];

      for (let match = 0; match < extendedN / 2; match++) {
        const home = (round + match) % (extendedN - 1);
        const away = (extendedN - 1 - match + round) % (extendedN - 1);

        const homeTeam =
          home === extendedN - 1
            ? extendedParticipants[extendedN - 1]
            : extendedParticipants[home];
        const awayTeam =
          away === extendedN - 1
            ? extendedParticipants[extendedN - 1]
            : extendedParticipants[away];

        // Skip matches involving null (bye)
        if (homeTeam && awayTeam && homeTeam !== awayTeam) {
          roundFixtures.push({
            tournamentId,
            matchday,
            homeTeam,
            awayTeam,
          });
        }
      }

      fixtures.push(...roundFixtures);
      matchday++;
    }
  }

  return fixtures;
};

// Double Round-Robin Algorithm
const generateDoubleRoundRobinFixtures = (participants, tournamentId) => {
  // Generate first round-robin
  const firstRound = generateSingleRoundRobinFixtures(
    participants,
    tournamentId
  );

  // Generate second round-robin (reverse home/away)
  const maxMatchday = Math.max(...firstRound.map((f) => f.matchday));
  const secondRound = firstRound.map((fixture) => ({
    ...fixture,
    matchday: fixture.matchday + maxMatchday,
    homeTeam: fixture.awayTeam, // Swap home and away
    awayTeam: fixture.homeTeam,
  }));

  return [...firstRound, ...secondRound];
};

// Get tournament fixtures with details
export const getTournamentFixtures = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  const fixtures = await fixtureDb.getTournamentFixtures(tournamentId);

  return {
    tournament: {
      name: tournament.name,
      status: tournament.status,
      currentMatchday: tournament.currentMatchday,
      totalMatchdays: tournament.totalMatchdays,
    },
    fixtures,
    fixturesCount: fixtures.length,
  };
};

// Get fixtures for specific matchday
export const getMatchdayFixtures = async ({ tournamentId, matchday }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  const fixtures = await fixtureDb.getMatchdayFixtures(tournamentId, matchday);
  const stats = await fixtureDb.getMatchdayStats(tournamentId, matchday);

  return {
    matchday,
    tournament: tournament.name,
    fixtures,
    stats,
  };
};

// Get team's fixtures
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

// Regenerate fixtures (admin only)
export const regenerateFixtures = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Check permissions
  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  // Can't regenerate if tournament has started
  if (tournament.status === "ongoing") {
    throw new BadRequestError(
      "Cannot regenerate fixtures for ongoing tournament"
    );
  }

  // Delete existing fixtures
  await fixtureDb.deleteAllFixtures(tournamentId);

  // Reset tournament status
  await tournamentDb.updateTournament(tournamentId, {
    status: "registration",
    currentMatchday: 0,
    totalMatchdays: 0,
  });

  // Generate new fixtures
  return await generateTournamentFixtures({ tournamentId, userId });
};

// Start tournament (moves from upcoming to ongoing)
export const startTournament = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Check permissions
  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  // Check if fixtures exist
  const fixturesExist = await fixtureDb.fixturesExist(tournamentId);
  if (!fixturesExist) {
    throw new BadRequestError("Generate fixtures before starting tournament");
  }

  // Update tournament status
  await tournamentDb.updateTournament(tournamentId, {
    status: "ongoing",
    startDate: new Date(),
  });

  return {
    message: "Tournament started successfully",
    status: "ongoing",
  };
};
