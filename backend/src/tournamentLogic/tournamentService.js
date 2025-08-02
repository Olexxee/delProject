import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as userStatsService from "../user/statschemaService.js";
import * as groupDb from "../groupLogic/gSchemaService.js";
import {
  ConflictException,
  NotFoundException,
  BadRequestError,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";
import moment from "moment";

// Validate tournament creation
export const validateTournamentCreation = async ({
  userId,
  groupId,
  name,
  startDate,
  registrationDeadline,
}) => {
  // Check if user is group admin
  await membershipService.assertIsAdmin({ userId, groupId });

  // Check if group exists
  const group = await groupDb.findGroupById(groupId);
  if (!group) {
    throw new NotFoundException("Group not found");
  }

  // Check for duplicate tournament names in group
  const existingTournament = await tournamentDb.findTournamentByNameInGroup(
    name,
    groupId
  );
  if (existingTournament) {
    throw new ConflictException(
      "A tournament with this name already exists in this group"
    );
  }

  // Validate dates
  if (moment(registrationDeadline).isAfter(startDate)) {
    throw new BadRequestError(
      "Registration deadline must be before tournament start date"
    );
  }

  return { group };
};

// Create tournament
export const createTournament = async (payload) => {
  const { userId, groupId } = payload;

  // Validate creation
  const { group } = await validateTournamentCreation(payload);

  // Calculate total matchdays for league
  const { rounds, maxParticipants } = payload;
  const roundMultiplier = rounds === "double" ? 2 : 1;
  const totalMatchdays =
    maxParticipants > 1 ? (maxParticipants - 1) * roundMultiplier : 0;

  // Create tournament
  const tournament = await tournamentDb.createTournament({
    ...payload,
    createdBy: userId,
    totalMatchdays,
  });

  if (!tournament) {
    throw new BadRequestError("Failed to create tournament");
  }

  return tournament;
};

// Get tournament details
export const getTournamentById = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }
  return tournament;
};

// Get tournaments for a group
export const getGroupTournaments = async (groupId, status = null) => {
  const group = await groupDb.findGroupById(groupId);
  if (!group) {
    throw new NotFoundException("Group not found");
  }

  return await tournamentDb.findTournamentsByGroup(groupId, status);
};

// Update tournament (admin only)
export const updateTournament = async ({
  tournamentId,
  userId,
  updateData,
}) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Check if user is group admin
  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  // Prevent updates if tournament has started
  if (tournament.status === "ongoing") {
    throw new BadRequestError(
      "Cannot update tournament that has already started"
    );
  }

  return await tournamentDb.updateTournament(tournamentId, {
    ...updateData,
    updatedAt: new Date(),
  });
};

// Delete/Cancel tournament
export const cancelTournament = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Check if user is group admin
  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  // Can't cancel ongoing tournaments
  if (tournament.status === "ongoing") {
    throw new BadRequestError(
      "Cannot cancel tournament that has already started"
    );
  }

  return await tournamentDb.updateTournament(tournamentId, {
    status: "cancelled",
    updatedAt: new Date(),
  });
};

// Get tournament with fixture summary
export const getTournamentWithFixtures = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Get fixture statistics
  const fixtureStats = await fixtureDb.getTournamentFixtures(tournamentId);
  const completedFixtures = fixtureStats.filter(f => f.isCompleted).length;
  const totalFixtures = fixtureStats.length;

  return {
    ...tournament.toObject(),
    fixtureStats: {
      total: totalFixtures,
      completed: completedFixtures,
      remaining: totalFixtures - completedFixtures,
      progress: totalFixtures > 0 ? Math.round((completedFixtures / totalFixtures) * 100) : 0,
    },
  };
};

// Check if tournament is ready to start
export const checkTournamentReadiness = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  const fixturesExist = await fixtureDb.fixturesExist(tournamentId);
  const hasMinimumParticipants = tournament.currentParticipants >= 4;

  return {
    isReady: fixturesExist && hasMinimumParticipants && tournament.status === "upcoming",
    checks: {
      fixturesGenerated: fixturesExist,
      minimumParticipants: hasMinimumParticipants,
      correctStatus: tournament.status === "upcoming",
    },
  };
};

export const getTournamentWithTable = async (tournamentId) => {
  const tournament = await getTournamentById(tournamentId);
  const table = await leagueTableService.generateLeagueTable(tournamentId);

  return {
    tournament,
    currentTable: table.table.slice(0, 10),
    tableStats: {
      totalTeams: table.table.length,
      matchesPlayed:
        table.table.reduce((sum, team) => sum + team.matchesPlayed, 0) / 2,
      goalsScored: table.table.reduce((sum, team) => sum + team.goalsFor, 0),
    },
  };
};
