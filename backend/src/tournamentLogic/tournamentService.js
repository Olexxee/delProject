import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as fixturesService from "./fixtureService.js";
import * as notificationService from "../groupLogic/notifications/notificationService.js";
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
  type,
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

export const createTournament = async (payload) => {
  const { userId, groupId, type, rounds, maxParticipants } = payload;

  const { group } = await validateTournamentCreation(payload);

  let totalMatchdays = 0;
  let structureData = {};

  switch (type) {
    case "league":
      const roundMultiplier = rounds === "double" ? 2 : 1;
      totalMatchdays =
        maxParticipants > 1 ? (maxParticipants - 1) * roundMultiplier : 0;
      structureData = { totalMatchdays };
      break;

    case "cup":
      // 8 participants → 7 matches total
      const totalRounds = Math.ceil(Math.log2(maxParticipants));
      structureData = { totalRounds };
      break;

    case "hybrid":
      // Group stage + knockout
      structureData = {
        groupStage: true,
        knockoutRounds: Math.ceil(Math.log2(maxParticipants / 2)), // top half advance
      };
      break;

    default:
      throw new BadRequestError("Invalid tournament type");
  }

  const tournament = await tournamentDb.createTournament({
    ...payload,
    createdBy: userId,
    ...structureData,
  });

  if (!tournament) {
    throw new BadRequestError("Failed to create tournament");
  }

  // Notify admin or creator
  await notificationService.createNotification({
    user: creatorId,
    type: "tournament_created",
    message: `Your tournament "${tournament.name}" has been created successfully.`,
    referenceId: tournament._id,
  });

  // Broadcast to all connected users (optional)
  io.emit("tournament:new", {
    message: `A new tournament "${tournament.name}" is open for registration!`,
    tournamentId: tournament._id,
  });

  return tournament;
};

export const startTournamentLogic = async (tournamentId, initiatorId) => {
  const tournament = await tournamentService.getTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found.");

  // Ensure tournament is ready to start
  if (
    tournament.status !== "upcoming" &&
    tournament.status !== "registration"
  ) {
    throw new BadRequestException(
      "Tournament cannot be started in this phase."
    );
  }

  // Ensure minimum participants
  if (tournament.currentParticipants < 4)
    throw new BadRequestException(
      "Not enough participants to start the tournament."
    );

  // STEP 1️⃣: Generate fixtures
  const fixtureResult = await fixturesService.generateTournamentFixtures({
    tournamentId,
    userId: initiatorId,
  });

  // STEP 2️⃣: Update tournament status
  await tournamentService.updateTournament(tournamentId, {
    status: "ongoing",
    startedAt: new Date(),
  });

  // STEP 3️⃣: Notify participants
  await Promise.all(
    tournament.participants.map((p) =>
      notificationService.createNotification({
        user: p.userId._id || p.userId,
        type: "tournament_started",
        message: `Tournament "${tournament.name}" has officially started! Check your fixtures.`,
        referenceId: tournament._id,
      })
    )
  );

  // STEP 4️⃣: Real-time event
  io.emit("tournament:started", {
    tournamentId: tournament._id,
    name: tournament.name,
    type: tournament.type,
    fixtureCount: fixtureResult.count,
  });

  return {
    message: "Tournament started successfully",
    tournamentId: tournament._id,
    fixtureSummary: {
      totalFixtures: fixtureResult.count,
      type: fixtureResult.type,
    },
  };
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
  const completedFixtures = fixtureStats.filter((f) => f.isCompleted).length;
  const totalFixtures = fixtureStats.length;

  return {
    ...tournament.toObject(),
    fixtureStats: {
      total: totalFixtures,
      completed: completedFixtures,
      remaining: totalFixtures - completedFixtures,
      progress:
        totalFixtures > 0
          ? Math.round((completedFixtures / totalFixtures) * 100)
          : 0,
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
    isReady:
      fixturesExist &&
      hasMinimumParticipants &&
      tournament.status === "upcoming",
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
