import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as userStatsService from "../user/statschemaService.js";
import { NotFoundException } from "../lib/classes/errorClasses.js";

/**
 * Generate tournament standings based on tournament type
 */
export const generateTournamentTable = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  if (["league", "hybrid"].includes(tournament.type)) {
    return await generateLeagueTable(tournament);
  }

  return {
    tournament: {
      id: tournament._id,
      name: tournament.name,
      type: tournament.type,
      status: tournament.status,
    },
    table: [],
    message: "No table available for cup tournaments (knockout format).",
  };
};

/**
 * Build league or hybrid group standings table
 */
export const generateLeagueTable = async (tournament) => {
  const tournamentId = tournament._id;

  // Collect active participants
  const participants = tournament.participants
    .filter((p) => p.status === "registered")
    .map((p) => p.userId._id || p.userId);

  // Retrieve all completed fixtures
  let completedFixtures = await fixtureDb.getCompletedFixtures(tournamentId);

  // Filter for hybrid group stage
  if (tournament.type === "hybrid") {
    completedFixtures = completedFixtures.filter((f) => f.type === "group");
  }

  // Initialize table map
  const tableData = {};
  participants.forEach((id) => {
    tableData[id.toString()] = {
      userId: id,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
      position: 0,
      group: null,
    };
  });

  // Compute stats from fixtures
  for (const fixture of completedFixtures) {
    const homeId = fixture.homeTeam._id.toString();
    const awayId = fixture.awayTeam._id.toString();
    const homeGoals = fixture.homeGoals || 0;
    const awayGoals = fixture.awayGoals || 0;

    const home = tableData[homeId];
    const away = tableData[awayId];
    if (!home || !away) continue;

    home.matchesPlayed++;
    away.matchesPlayed++;

    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    let homeResult, awayResult;

    if (homeGoals > awayGoals) {
      home.wins++;
      away.losses++;
      home.points += tournament.settings.pointsForWin;
      away.points += tournament.settings.pointsForLoss;
      homeResult = "W";
      awayResult = "L";
    } else if (homeGoals < awayGoals) {
      away.wins++;
      home.losses++;
      away.points += tournament.settings.pointsForWin;
      home.points += tournament.settings.pointsForLoss;
      homeResult = "L";
      awayResult = "W";
    } else {
      home.draws++;
      away.draws++;
      home.points += tournament.settings.pointsForDraw;
      away.points += tournament.settings.pointsForDraw;
      homeResult = awayResult = "D";
    }

    home.form.push(homeResult);
    away.form.push(awayResult);
    if (home.form.length > 5) home.form = home.form.slice(-5);
    if (away.form.length > 5) away.form = away.form.slice(-5);

    if (tournament.type === "hybrid" && fixture.group) {
      home.group = fixture.group;
      away.group = fixture.group;
    }
  }

  // Convert to array and sort
  let tableArray = Object.values(tableData);

  if (tournament.type === "hybrid") {
    const grouped = {};
    for (const row of tableArray) {
      const groupName = row.group || "General";
      if (!grouped[groupName]) grouped[groupName] = [];
      grouped[groupName].push(row);
    }

    for (const groupName of Object.keys(grouped)) {
      grouped[groupName].sort(sortLeagueRow);
      grouped[groupName].forEach((team, i) => (team.position = i + 1));
    }

    const populated = await Promise.all(
      Object.entries(grouped).map(async ([groupName, rows]) => ({
        group: groupName,
        teams: await populateUsers(rows),
      }))
    );

    return {
      tournament: baseTournamentMeta(tournament),
      groups: populated,
      lastUpdated: new Date(),
    };
  }

  // League mode
  tableArray.sort(sortLeagueRow);
  tableArray.forEach((team, i) => (team.position = i + 1));

  return {
    tournament: baseTournamentMeta(tournament),
    table: await populateUsers(tableArray),
    lastUpdated: new Date(),
  };
};

/**
 * Update tournament table dynamically after fixture completion
 */
export const updateLeagueTableFromFixture = async (fixture) => {
  const tournamentId = fixture.tournamentId._id || fixture.tournamentId;
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  // Regenerate table
  const updatedTable = await generateTournamentTable(tournamentId);

  // Persist cached snapshot (optional)
  await tournamentDb.updateTournament(tournamentId, {
    lastTableUpdate: new Date(),
    cachedTable: updatedTable,
  });

  // Optionally sync player stats
  await syncPlayerStatsFromFixture(fixture);

  return updatedTable;
};

/**
 * Sync user statistics from fixture result
 */
const syncPlayerStatsFromFixture = async (fixture) => {
  const { homeTeam, awayTeam, homeGoals, awayGoals } = fixture;
  const homeId = homeTeam._id || homeTeam;
  const awayId = awayTeam._id || awayTeam;

  const homeResult =
    homeGoals > awayGoals ? "win" : homeGoals < awayGoals ? "loss" : "draw";
  const awayResult =
    awayGoals > homeGoals ? "win" : awayGoals < homeGoals ? "loss" : "draw";

  await userStatsService.updateUserStatsAfterMatch(homeId, {
    result: homeResult,
    goalsFor: homeGoals,
    goalsAgainst: awayGoals,
  });

  await userStatsService.updateUserStatsAfterMatch(awayId, {
    result: awayResult,
    goalsFor: awayGoals,
    goalsAgainst: homeGoals,
  });
};

/**
 * Helpers
 */
const sortLeagueRow = (a, b) => {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference)
    return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return 0;
};

const baseTournamentMeta = (tournament) => ({
  id: tournament._id,
  name: tournament.name,
  type: tournament.type,
  status: tournament.status,
  currentMatchday: tournament.currentMatchday,
  totalMatchdays: tournament.totalMatchdays,
});

const populateUsers = async (rows) => {
  return await Promise.all(
    rows.map(async (team) => {
      const userDetails = await getUserDetails(team.userId);
      return { ...team, user: userDetails };
    })
  );
};

// Stub: replace with actual user retrieval
const getUserDetails = async (userId) => ({
  id: userId,
  username: `User_${userId.toString().slice(-4)}`,
});
