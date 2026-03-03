import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as userService from "../user/userService.js";
import Group from "../groupLogic/groupSchema.js";
import { updateGroupMetrics } from "../groupLogic/groupMetric.js";
import * as userStatsService from "../user/statschemaService.js";
import {
  NotFoundException,
  BadRequestError,
} from "../lib/classes/errorClasses.js";

// ─── TOURNAMENT CREATION ───────────────────────────────────────────────────────
export const createTournament = async (data) => {
  const tournament = await tournamentDb.createTournament(data);
  await Group.findByIdAndUpdate(data.groupId, {
    $inc: { tournamentsCount: 1 },
    $set: { lastTournamentAt: new Date() },
  });
  await updateGroupMetrics(data.groupId);
  return tournament;
};

// ─── GET ACTIVE TOURNAMENT FOR A GROUP ─────────────────────────────────────────
export const getGroupTournaments = async (groupId, status = undefined) => {
  return tournamentDb.findTournamentsByGroup(groupId, status);
};

// ─── GET ALL FIXTURES FOR A TOURNAMENT (ENRICHED) ─────────────────────────────
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

// ─── GET FIXTURES FOR A SPECIFIC MATCHDAY ─────────────────────────────────────
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

// ─── GET TEAM SPECIFIC FIXTURES ───────────────────────────────────────────────
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

// ─── GET UPCOMING FIXTURES FOR USER ──────────────────────────────────────────
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

  // Sort by scheduledDate
  upcomingFixtures.sort(
    (a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate),
  );

  return upcomingFixtures;
};

// ─── TOURNAMENT PREVIEW FOR USER ─────────────────────────────────────────────
export const getTournamentPreview = async (tournamentId, userId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const participant = tournament.participants.find(
    (p) => p.userId.toString() === userId.toString(),
  );
  const myRole = participant ? participant.status : null;

  const myStats = await userStatsService.getUserTournamentStats(
    tournamentId,
    userId,
  );
  const upcomingFixtures = await fixtureDb.getUpcomingFixtures(tournamentId);

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

// ─── UPDATE TOURNAMENT STATUS ────────────────────────────────────────────────
export const updateTournamentStatus = async ({ tournamentId, newStatus }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const oldStatus = tournament.status;
  tournament.status = newStatus;
  await tournament.save();

  const groupId = tournament.groupId;

  // Update group counters
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

  await updateGroupMetrics(groupId);

  return tournament;
};
