import mongoose from "mongoose";
import moment from "moment";
import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as userService from "../user/userService.js";
import * as userStatsService from "../user/statschemaService.js";
import * as membershipSchemaService from "../groupLogic/membershipSchemaService.js";
import * as groupDb from "../groupLogic/gSchemaService.js";
import Group from "../groupLogic/groupSchema.js";
import { updateGroupMetrics } from "../groupLogic/groupMetric.js";
import cache from "../lib/cache.js";
import {
  NotFoundException,
  BadRequestError,
  ConflictException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";

// ================================
// CREATE TOURNAMENT
// ================================
export const createTournament = async (data) => {
  const tournament = await tournamentDb.createTournament(data);

  await Group.findByIdAndUpdate(data.groupId, {
    $inc: { tournamentsCount: 1 },
    $set: { lastTournamentAt: new Date() },
  });

  await updateGroupMetrics(data.groupId);
  return tournament;
};

// ================================
// GET TOURNAMENT BY ID (ENRICHED)
// Includes participants with user details + userContext
// ================================
export const getTournamentById = async (tournamentId, userId = null) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  // Resolve participant user details
  const participantDetails = await Promise.all(
    (tournament.participants ?? []).map(async (p) => {
      try {
        const user = await userService.getUserById(p.userId ?? p);
        return {
          userId: user._id,
          username: user.username,
          profilePicture: user.profilePicture ?? null,
          status: p.status ?? "active",
        };
      } catch {
        return null;
      }
    }),
  );

  const participants = participantDetails.filter(Boolean);

  // Derive userContext from participants if userId provided
  const userContext = userId
    ? (() => {
        const match = (tournament.participants ?? []).find(
          (p) => (p.userId ?? p).toString() === userId.toString(),
        );
        return {
          isRegistered: !!match,
          role: match?.status ?? null,
        };
      })()
    : { isRegistered: false, role: null };

  return {
    ...tournament.toObject(),
    participants,
    userContext,
  };
};

// ================================
// GET TOURNAMENTS FOR A GROUP
// ================================
export const getGroupTournaments = async (groupId, status = undefined) => {
  return tournamentDb.findTournamentsByGroup(groupId, status);
};

// ================================
// GET ALL TOURNAMENTS (PAGINATED)
// ================================
export const getAllTournaments = async ({ page = 1, limit = 10, status }) => {
  const skip = (page - 1) * limit;
  const filter = {};
  if (status) filter.status = status;

  const [tournaments, total] = await Promise.all([
    tournamentDb.findAllTournaments(filter, skip, limit),
    tournamentDb.countTournaments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    tournaments,
    pagination: {
      total,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
    },
  };
};

// ================================
// JOIN GROUP + TOURNAMENT (COMBINED)
// Adds user to group if not already a member,
// then registers for tournament — all in one transaction.
// ================================
export const joinGroupAndTournament = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) throw new NotFoundException("Tournament not found");

    const groupId = tournament.groupId._id ?? tournament.groupId;

    // Validate tournament is open
    if (tournament.status !== "registration") {
      throw new BadRequestError("Tournament registration is closed");
    }
    if (moment().isAfter(tournament.registrationDeadline)) {
      throw new BadRequestError("Registration deadline has passed");
    }

    const capacityCheck =
      await tournamentDb.checkTournamentCapacity(tournamentId);
    if (capacityCheck.isFull) throw new BadRequestError("Tournament is full");

    // Check not already registered
    const alreadyRegistered = await tournamentDb.findUserInTournament(
      tournamentId,
      userId,
    );
    if (alreadyRegistered)
      throw new ConflictException("Already registered for this tournament");

    // Join group if not already an active member
    const existingMembership = await membershipSchemaService.findMembership({
      userId,
      groupId,
    });

    if (!existingMembership) {
      await membershipSchemaService.createMembership(
        { userId, groupId, roleInGroup: "member", status: "active" },
        session,
      );
      await groupDb.updateGroup(
        groupId,
        { $inc: { totalMembers: 1 } },
        session,
      );
      const group = await groupDb.findGroupById(groupId, session);
      await userService.findAndUpdateUserById(
        userId,
        { $addToSet: { groups: group.name } },
        session,
      );
    } else if (existingMembership.status === "banned") {
      throw new ForbiddenError("You are banned from this group");
    } else if (existingMembership.status !== "active") {
      // Reactivate pending/inactive membership
      await membershipSchemaService.updateMembership(
        { userId, groupId },
        { status: "active" },
        { new: true },
        session,
      );
      await groupDb.updateGroup(
        groupId,
        { $inc: { totalMembers: 1 } },
        session,
      );
    }
    // If already active member — skip silently

    // Register for tournament
    const updatedTournament = await tournamentDb.addParticipant(
      tournamentId,
      userId,
      { session },
    );

    // Create user stats for this tournament
    await userStatsService.createUserStats({
      user: userId,
      group: groupId,
      tournamentsPlayedin: tournamentId,
      session,
    });

    // Update group metrics once
    await updateGroupMetrics(groupId, session);

    await session.commitTransaction();

    return {
      tournament: updatedTournament,
      message: "Successfully joined group and registered for tournament",
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ================================
// GET ALL FIXTURES FOR A TOURNAMENT (ENRICHED)
// ================================
export const getTournamentFixtures = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const fixtures = await fixtureDb.getTournamentFixtures(tournamentId);

  return Promise.all(
    fixtures.map(async (f) => {
      const [homeTeam, awayTeam] = await Promise.all([
        userService.getUserById(f.homeTeam._id),
        userService.getUserById(f.awayTeam._id),
      ]);

      return {
        id: f._id,
        matchday: f.matchday,
        scheduledDate: f.scheduledDate,
        status: f.status,
        isCompleted: f.isCompleted,
        homeTeam: {
          id: homeTeam._id,
          username: homeTeam.username,
          profilePicture: homeTeam.profilePicture,
          role: homeTeam.role,
        },
        awayTeam: {
          id: awayTeam._id,
          username: awayTeam.username,
          profilePicture: awayTeam.profilePicture,
          role: awayTeam.role,
        },
        homeGoals: f.homeGoals,
        awayGoals: f.awayGoals,
      };
    }),
  );
};

// ================================
// GET FIXTURES FOR A SPECIFIC MATCHDAY
// ================================
export const getMatchdayFixtures = async ({ tournamentId, matchday }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const fixtures = await fixtureDb.getMatchdayFixtures(tournamentId, matchday);

  return Promise.all(
    fixtures.map(async (f) => {
      const [homeTeam, awayTeam] = await Promise.all([
        userService.getUserById(f.homeTeam._id),
        userService.getUserById(f.awayTeam._id),
      ]);

      return {
        id: f._id,
        matchday: f.matchday,
        scheduledDate: f.scheduledDate,
        status: f.status,
        isCompleted: f.isCompleted,
        homeTeam: {
          id: homeTeam._id,
          username: homeTeam.username,
          profilePicture: homeTeam.profilePicture,
        },
        awayTeam: {
          id: awayTeam._id,
          username: awayTeam.username,
          profilePicture: awayTeam.profilePicture,
        },
        homeGoals: f.homeGoals,
        awayGoals: f.awayGoals,
      };
    }),
  );
};

// ================================
// GET TEAM-SPECIFIC FIXTURES
// ================================
export const getTeamFixtures = async ({ tournamentId, teamId }) => {
  const fixtures = await fixtureDb.getTeamFixtures(tournamentId, teamId);

  return Promise.all(
    fixtures.map(async (f) => {
      const [homeTeam, awayTeam] = await Promise.all([
        userService.getUserById(f.homeTeam._id),
        userService.getUserById(f.awayTeam._id),
      ]);

      const isHome = f.homeTeam._id.toString() === teamId.toString();
      const opponent = isHome ? awayTeam : homeTeam;

      return {
        id: f._id,
        matchday: f.matchday,
        scheduledDate: f.scheduledDate,
        status: f.status,
        isCompleted: f.isCompleted,
        isHome,
        opponent: {
          id: opponent._id,
          username: opponent.username,
          profilePicture: opponent.profilePicture,
        },
        homeTeamGoals: f.homeGoals,
        awayTeamGoals: f.awayGoals,
      };
    }),
  );
};

// ================================
// CHECK TOURNAMENT READINESS
// ================================
export const checkTournamentReadiness = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const totalParticipants = tournament.participants.length;
  const { maxParticipants } = tournament;
  const registrationClosed =
    new Date(tournament.registrationDeadline) < new Date();

  const readiness = {
    tournamentId: tournament._id,
    status: tournament.status,
    totalParticipants,
    maxParticipants,
    registrationClosed,
    isFull: totalParticipants === maxParticipants,
    hasMinimumParticipants: totalParticipants >= 2,
    canStart: false,
    reasons: [],
  };

  if (tournament.status !== "registration") {
    readiness.reasons.push("Tournament is not in registration phase");
    return readiness;
  }

  if (totalParticipants < 2) {
    readiness.reasons.push("At least 2 participants required");
  }

  if (!registrationClosed && totalParticipants < maxParticipants) {
    readiness.reasons.push(
      "Registration still open and tournament is not full",
    );
  }

  if (readiness.reasons.length === 0) {
    readiness.canStart = true;
  }

  return readiness;
};

// ================================
// GET UPCOMING FIXTURES FOR USER
// ================================
export const getUpcomingFixturesForUser = async (userId) => {
  const tournaments = await tournamentDb.findUserTournaments(userId);
  const upcomingFixtures = [];

  for (const t of tournaments) {
    const fixtures = await fixtureDb.getUserUpcomingFixtures(t._id, userId);

    const enriched = await Promise.all(
      fixtures.map(async (f) => {
        const [homeTeam, awayTeam] = await Promise.all([
          userService.getUserById(f.homeTeam._id),
          userService.getUserById(f.awayTeam._id),
        ]);

        const isHome = f.homeTeam._id.toString() === userId.toString();
        const opponent = isHome ? awayTeam : homeTeam;

        return {
          id: f._id,
          tournamentId: t._id,
          tournamentName: t.name,
          matchday: f.matchday,
          scheduledDate: f.scheduledDate,
          status: f.status,
          isCompleted: f.isCompleted,
          isHome,
          opponent: {
            id: opponent._id,
            username: opponent.username,
            profilePicture: opponent.profilePicture,
          },
          homeGoals: f.homeGoals,
          awayGoals: f.awayGoals,
        };
      }),
    );

    upcomingFixtures.push(...enriched);
  }

  upcomingFixtures.sort(
    (a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate),
  );

  return upcomingFixtures;
};

// ================================
// GET TOURNAMENT PREVIEW FOR USER
// ================================
export const getTournamentPreview = async (tournamentId, userId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const participant = tournament.participants.find(
    (p) => p.userId.toString() === userId.toString(),
  );
  const myRole = participant ? participant.status : null;

  const [myStats, upcomingFixtures] = await Promise.all([
    userStatsService.getUserTournamentStats(tournamentId, userId),
    fixtureDb.getUpcomingFixtures(tournamentId),
  ]);

  const nextMatchRaw = upcomingFixtures[0] ?? null;
  let nextMatch = null;

  if (nextMatchRaw) {
    const opponentId =
      nextMatchRaw.homeTeam.toString() === userId.toString()
        ? nextMatchRaw.awayTeam
        : nextMatchRaw.homeTeam;

    const opponent = await userService.getUserById(opponentId);

    nextMatch = {
      id: nextMatchRaw._id,
      matchday: nextMatchRaw.matchday,
      scheduledDate: nextMatchRaw.scheduledDate,
      isHome: nextMatchRaw.homeTeam.toString() === userId.toString(),
      opponent: {
        id: opponent._id,
        username: opponent.username,
        profilePicture: opponent.profilePicture,
      },
    };
  }

  return {
    tournament: {
      id: tournament._id,
      name: tournament.name,
      status: tournament.status,
      type: tournament.type,
      currentMatchday: tournament.currentMatchday,
      totalMatchdays: tournament.totalMatchdays,
      startDate: tournament.startDate,
      rules: tournament.rules,
    },
    userContext: {
      role: myRole,
      isRegistered: !!myRole,
      stats: myStats || { wins: 0, draws: 0, losses: 0, points: 0 },
    },
    nextMatch,
  };
};

// ================================
// UPDATE TOURNAMENT STATUS
// ================================
export const updateTournamentStatus = async ({ tournamentId, newStatus }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const oldStatus = tournament.status;
  tournament.status = newStatus;
  await tournament.save();

  const { groupId } = tournament;

  if (oldStatus !== "ongoing" && newStatus === "ongoing") {
    await Group.findByIdAndUpdate(groupId, {
      $inc: { activeTournamentsCount: 1 },
      $set: { lastTournamentAt: new Date() },
    });
  }

  if (oldStatus === "ongoing" && newStatus === "completed") {
    await Group.findByIdAndUpdate(groupId, {
      $inc: { activeTournamentsCount: -1 },
    });
  }

  await cache.deleteByPattern(`tournament:${tournamentId}:*`);
  await updateGroupMetrics(groupId);

  return tournament;
};
