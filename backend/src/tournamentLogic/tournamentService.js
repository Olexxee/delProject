import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as userService from "../user/userService.js";
import * as userStatsService from "../user/statschemaService.js";
import {
  NotFoundException,
  BadRequestError,
} from "../lib/classes/errorClasses.js";

// -------------------------------
// GET ALL TOURNAMENT FIXTURES (ENRICHED)
// -------------------------------
export const getTournamentFixtures = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const fixtures = await fixtureDb.getTournamentFixtures(tournamentId);

  const enrichedFixtures = await Promise.all(
    fixtures.map(async (f) => {
      const homeTeam = await userService.getUserById(f.homeTeam._id);
      const awayTeam = await userService.getUserById(f.awayTeam._id);

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
    })
  );

  return enrichedFixtures;
};

// -------------------------------
// GET MATCHDAY FIXTURES
// -------------------------------
export const getMatchdayFixtures = async ({ tournamentId, matchday }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const fixtures = await fixtureDb.getMatchdayFixtures(tournamentId, matchday);

  const enriched = await Promise.all(
    fixtures.map(async (f) => {
      const homeTeam = await userService.getUserById(f.homeTeam._id);
      const awayTeam = await userService.getUserById(f.awayTeam._id);

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
    })
  );

  return enriched;
};

// -------------------------------
// GET TEAM FIXTURES
// -------------------------------
export const getTeamFixtures = async ({ tournamentId, teamId }) => {
  const fixtures = await fixtureDb.getTeamFixtures(tournamentId, teamId);

  const enriched = await Promise.all(
    fixtures.map(async (f) => {
      const homeTeam = await userService.getUserById(f.homeTeam._id);
      const awayTeam = await userService.getUserById(f.awayTeam._id);

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
    })
  );

  return enriched;
};

// -------------------------------
// GET UPCOMING FIXTURES FOR USER
// -------------------------------
export const getUpcomingFixturesForUser = async (userId) => {
  // Get tournaments user is registered in
  const tournaments = await tournamentDb.findUserTournaments(userId);

  const upcomingFixtures = [];

  for (const t of tournaments) {
    const fixtures = await fixtureDb.getUserUpcomingFixtures(t._id, userId);

    const enriched = await Promise.all(
      fixtures.map(async (f) => {
        const homeTeam = await userService.getUserById(f.homeTeam._id);
        const awayTeam = await userService.getUserById(f.awayTeam._id);
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
      })
    );

    upcomingFixtures.push(...enriched);
  }

  // Sort by scheduledDate
  upcomingFixtures.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

  return upcomingFixtures;
};
