import * as tournamentDb from "./tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as userStatsService from "../user/statschemaService.js";
import * as userService from "../user/userService.js";
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
    userId
  );
  if (existingRegistration) {
    throw new ConflictException(
      "You are already registered for this tournament"
    );
  }

  // Check capacity
  const capacityCheck = await tournamentDb.checkTournamentCapacity(
    tournamentId
  );
  if (capacityCheck.isFull) {
    throw new BadRequestError("Tournament is full");
  }

  // Register participant
  const updatedTournament = await tournamentDb.addParticipant(
    tournamentId,
    userId
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
    userId
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
    tournament.groupId._id || tournament.groupId
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
      `✅ Tournament stats created for user ${userId} in tournament ${tournamentId}`
    );
  } catch (error) {
    // Handle duplicate key error (stats already exist)
    if (error.code !== 11000) {
      console.error("Error creating tournament stats:", error);
      throw error;
    }
  }
};

// 🎯 STATS UPDATE FUNCTION FOR MATCH RESULTS
export const updateParticipantStats = async ({
  matchId,
  tournamentId,
  participants,
}) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);

  for (const participant of participants) {
    const { userId, score, isWinner, kills = 0 } = participant;

    // Determine match result
    const isWin = isWinner;
    const isDraw =
      !isWinner && participants.filter((p) => p.isWinner).length === 0;
    const isLoss = !isWinner && !isDraw;

    // Calculate points based on tournament settings
    let points = 0;
    if (isWin) points = tournament.settings.pointsForWin;
    else if (isDraw) points = tournament.settings.pointsForDraw;
    else points = tournament.settings.pointsForLoss;

    // Update tournament-specific stats
    await userStatsService.updateUserStats(
      userId,
      tournament.groupId._id || tournament.groupId,
      {
        $inc: {
          matchesPlayed: 1,
          wins: isWin ? 1 : 0,
          losses: isLoss ? 1 : 0,
          score: points,
        },
        lastUpdated: new Date(),
      }
    );

    console.log(`📊 Updated stats for user ${userId}: +${points} points`);
  }

  // Recalculate tournament standings after stats update
  await recalculateTournamentStandings(tournamentId);
};

// Recalculate tournament standings
const recalculateTournamentStandings = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);

  // Get all participant stats for this tournament
  const participantStats = await userStatsService.getGroupStatsByTournament(
    tournament.groupId._id || tournament.groupId,
    tournamentId
  );

  // Sort by points, then by wins, then by goal difference logic can be added
  participantStats.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.matchesPlayed - a.matchesPlayed;
  });

  // Update ranks
  for (let i = 0; i < participantStats.length; i++) {
    await userStatsService.updateUserStats(
      participantStats[i].user._id,
      tournament.groupId._id || tournament.groupId,
      { rank: i + 1 }
    );
  }

  console.log(
    `🏆 Tournament standings recalculated for tournament ${tournamentId}`
  );
};
