import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as userStatsService from "../user/statschemaService.js";
import {
  ConflictException,
  NotFoundException,
  BadRequestError,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";
import moment from "moment";

// Register user for tournament
export const registerParticipant = async ({ tournamentId, userId }) => {
  // Get tournament details
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Check tournament status
  if (tournament.status !== "registration") {
    throw new BadRequestError("Tournament registration is closed");
  }

  // Check registration deadline
  if (moment().isAfter(tournament.registrationDeadline)) {
    throw new BadRequestError("Registration deadline has passed");
  }

  // Check if user is member of the group
  const membership = await membershipService.findMembership({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });
  if (!membership) {
    throw new ForbiddenError("You must be a member of this group to register");
  }

  // Check if already registered
  const existingRegistration = await tournamentDb.findUserInTournament(
    tournamentId,
    userId,
  );
  if (existingRegistration) {
    throw new ConflictException(
      "You are already registered for this tournament",
    );
  }

  // Check capacity
  const capacityCheck =
    await tournamentDb.checkTournamentCapacity(tournamentId);
  if (capacityCheck.isFull) {
    throw new BadRequestError("Tournament is full");
  }

  // Register participant
  const updatedTournament = await tournamentDb.addParticipant(
    tournamentId,
    userId,
  );

  // 🎯 CREATE TOURNAMENT-SPECIFIC USER STATS
  await createTournamentStats({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
    tournamentId,
  });

  return {
    tournament: updatedTournament,
    message: "Successfully registered for tournament",
  };
};

// Bulk register participants (admin only)
export const bulkRegisterParticipants = async ({
  tournamentId,
  userIds,
  adminId,
}) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Check if admin has permission
  await membershipService.assertIsAdmin({
    userId: adminId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  const results = {
    successful: [],
    failed: [],
  };

  for (const userId of userIds) {
    try {
      await registerParticipant({ tournamentId, userId });
      results.successful.push(userId);
    } catch (error) {
      results.failed.push({ userId, error: error.message });
    }
  }

  return results;
};

// Withdraw from tournament
export const withdrawParticipant = async ({ tournamentId, userId, reason }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Check if user is registered
  const registration = await tournamentDb.findUserInTournament(
    tournamentId,
    userId,
  );
  if (!registration) {
    throw new NotFoundException("You are not registered for this tournament");
  }

  // Prevent withdrawal if tournament has started
  if (tournament.status === "ongoing") {
    throw new BadRequestError("Cannot withdraw from ongoing tournament");
  }

  // Update participant status to withdrawn
  await tournamentDb.updateParticipantStatus(tournamentId, userId, "withdrawn");

  // Decrease participant count
  await tournamentDb.updateTournament(tournamentId, {
    $inc: { currentParticipants: -1 },
  });

  // 🎯 REMOVE TOURNAMENT-SPECIFIC STATS
  await userStatsService.deleteUserStats(
    userId,
    tournament.groupId._id || tournament.groupId,
  );

  return {
    message: "Successfully withdrawn from tournament",
    reason,
  };
};

// Get tournament participants
export const getTournamentParticipants = async (tournamentId) => {
  const tournament = await tournamentDb.getTournamentParticipants(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  return tournament;
};

// Get user's tournaments
export const getUserTournaments = async (userId) => {
  return await tournamentDb.findUserTournaments(userId);
};

// 🎯 CREATE TOURNAMENT-SPECIFIC STATS
const createTournamentStats = async ({ userId, groupId, tournamentId }) => {
  try {
    // Create tournament-specific stats
    await userStatsService.createUserStats({
      user: userId,
      group: groupId,
      tournamentsPlayedin: tournamentId,
    });

    console.log(
      `✅ Tournament stats created for user ${userId} in tournament ${tournamentId}`,
    );
  } catch (error) {
    // Handle duplicate key error (stats already exist)
    if (error.code !== 11000) {
      console.error("Error creating tournament stats:", error);
      throw error;
    }
  }
};

// STATS UPDATE FUNCTION FOR MATCH RESULTS
export const updateParticipantStats = async ({
  matchId,
  tournamentId,
  participants,
  matchday,
  scheduledDate,
}) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const groupId = tournament.groupId._id || tournament.groupId;

  for (const participant of participants) {
    const { userId, goals = 0, isWinner } = participant;

    const opponent = participants.find(
      (p) => p.userId.toString() !== userId.toString(),
    );

    const result = isWinner ? "win" : opponent?.isWinner ? "loss" : "draw";

    const points =
      result === "win"
        ? tournament.settings.pointsForWin
        : result === "draw"
          ? tournament.settings.pointsForDraw
          : tournament.settings.pointsForLoss;

    const fixtureSummary = {
      fixtureId: matchId,
      opponent: opponent?.userId,
      homeOrAway: "home", // adjust if needed
      goalsFor: goals,
      goalsAgainst: opponent?.goals || 0,
      result,
      matchday,
      scheduledDate,
      status: "completed",
    };

    await UserStats.updateOne(
      {
        user: userId,
        group: groupId,
        "tournamentsPlayedIn.tournamentId": tournamentId,
      },
      {
        $inc: {
          "tournamentsPlayedIn.$.matchesPlayed": 1,
          "tournamentsPlayedIn.$.wins": result === "win" ? 1 : 0,
          "tournamentsPlayedIn.$.losses": result === "loss" ? 1 : 0,
          "tournamentsPlayedIn.$.draws": result === "draw" ? 1 : 0,
          "tournamentsPlayedIn.$.goalsScored": goals,
          "tournamentsPlayedIn.$.goalsConceded": opponent?.goals || 0,
          "tournamentsPlayedIn.$.points": points,
        },
        $push: {
          "tournamentsPlayedIn.$.fixtures": fixtureSummary,
        },
        $set: {
          lastUpdated: new Date(),
        },
      },
    );
  }

  await recalculateTournamentStandings(tournamentId);
};

// Recalculate tournament standings
const recalculateTournamentStandings = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new Error("Tournament not found");
  }

  const groupId = tournament.groupId._id || tournament.groupId;

  // Get all participant stats for this tournament
  const participantStats = await userStatsService.getGroupStatsByTournament(
    groupId,
    tournamentId,
  );

  if (!participantStats || participantStats.length === 0) {
    console.log("No participants found for standings recalculation.");
    return;
  }

  // 🔥 Correct ranking logic
  participantStats.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;

    const goalDiffA = a.goalsScored - a.goalsConceded;
    const goalDiffB = b.goalsScored - b.goalsConceded;

    if (goalDiffB !== goalDiffA) return goalDiffB - goalDiffA;

    return b.goalsScored - a.goalsScored;
  });

  // ✅ BULK RANK UPDATE
  const bulkOps = participantStats.map((stat, index) => ({
    updateOne: {
      filter: {
        user: stat.user._id,
        group: groupId,
        "tournamentsPlayedIn.tournamentId": tournamentId,
      },
      update: {
        $set: {
          "tournamentsPlayedIn.$.rank": index + 1,
        },
      },
    },
  }));

  await UserStats.bulkWrite(bulkOps);

  console.log(
    `🏆 Tournament standings recalculated for tournament ${tournamentId}`,
  );
};
