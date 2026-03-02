import mongoose from "mongoose";
import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as userStatsService from "../user/statschemaService.js";
import { updateGroupMetrics } from "../groupLogic/groupMetricsService.js";
import { NotFoundException } from "../lib/classes/errorClasses.js";

// -----------------------------
// HELPER: Build Table From Fixtures
// -----------------------------
const buildTable = (participants, fixtures, tournamentSettings) => {
  const tableData = {};

  // Initialize table
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
      form: [], // last 5 results
      position: 0,
    };
  });

  // Process completed fixtures
  fixtures.forEach((f) => {
    const homeId = f.homeTeam._id.toString();
    const awayId = f.awayTeam._id.toString();
    const homeGoals = f.homeGoals ?? 0;
    const awayGoals = f.awayGoals ?? 0;

    tableData[homeId].matchesPlayed++;
    tableData[awayId].matchesPlayed++;

    tableData[homeId].goalsFor += homeGoals;
    tableData[homeId].goalsAgainst += awayGoals;
    tableData[awayId].goalsFor += awayGoals;
    tableData[awayId].goalsAgainst += homeGoals;

    tableData[homeId].goalDifference =
      tableData[homeId].goalsFor - tableData[homeId].goalsAgainst;
    tableData[awayId].goalDifference =
      tableData[awayId].goalsFor - tableData[awayId].goalsAgainst;

    // Determine result
    let homeResult, awayResult;
    if (homeGoals > awayGoals) {
      tableData[homeId].wins++;
      tableData[awayId].losses++;
      tableData[homeId].points += tournamentSettings.pointsForWin;
      tableData[awayId].points += tournamentSettings.pointsForLoss;
      homeResult = "W";
      awayResult = "L";
    } else if (homeGoals < awayGoals) {
      tableData[awayId].wins++;
      tableData[homeId].losses++;
      tableData[awayId].points += tournamentSettings.pointsForWin;
      tableData[homeId].points += tournamentSettings.pointsForLoss;
      homeResult = "L";
      awayResult = "W";
    } else {
      tableData[homeId].draws++;
      tableData[awayId].draws++;
      tableData[homeId].points += tournamentSettings.pointsForDraw;
      tableData[awayId].points += tournamentSettings.pointsForDraw;
      homeResult = "D";
      awayResult = "D";
    }

    // Update last 5 results
    tableData[homeId].form.push(homeResult);
    tableData[awayId].form.push(awayResult);
    tableData[homeId].form = tableData[homeId].form.slice(-5);
    tableData[awayId].form = tableData[awayId].form.slice(-5);
  });

  // Convert to array and sort
  const tableArray = Object.values(tableData).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return 0; // Head-to-head logic can be added later
  });

  // Assign positions
  tableArray.forEach((team, idx) => (team.position = idx + 1));

  return tableArray;
};

// -----------------------------
// GENERATE CURRENT LEAGUE TABLE
// -----------------------------
export const generateLeagueTable = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const participants = tournament.participants
    .filter((p) => p.status === "registered")
    .map((p) => p.userId._id || p.userId);

  const completedFixtures = (
    await fixtureDb.getTournamentFixtures(tournamentId)
  ).filter((f) => f.isCompleted);

  // Fetch user details in one query
  const User = (await import("../user/userSchema.js")).default;
  const users = await User.find({ _id: { $in: participants } }).select(
    "username email profilePicture",
  );
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  // Build table
  const table = buildTable(
    participants,
    completedFixtures,
    tournament.settings,
  );

  // Attach user details
  const populatedTable = table.map((team) => ({
    ...team,
    user: userMap[team.userId.toString()] || null,
  }));

  // Update group metrics automatically after table recalculation
  await updateGroupMetrics(tournament.groupId._id || tournament.groupId);

  return {
    tournament: {
      id: tournament._id,
      name: tournament.name,
      status: tournament.status,
      currentMatchday: tournament.currentMatchday,
      totalMatchdays: tournament.totalMatchdays,
    },
    table: populatedTable,
    lastUpdated: new Date(),
  };
};

// -----------------------------
// GENERATE HISTORICAL TABLE
// -----------------------------
export const getHistoricalTable = async (tournamentId, upToMatchday) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const participants = tournament.participants
    .filter((p) => p.status === "registered")
    .map((p) => p.userId._id || p.userId);

  const completedFixtures = (
    await fixtureDb.getTournamentFixtures(tournamentId)
  ).filter((f) => f.isCompleted && f.matchday <= upToMatchday);

  const User = (await import("../user/userSchema.js")).default;
  const users = await User.find({ _id: { $in: participants } }).select(
    "username email profilePicture",
  );
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  const table = buildTable(
    participants,
    completedFixtures,
    tournament.settings,
  );

  const populatedTable = table.map((team) => ({
    ...team,
    user: userMap[team.userId.toString()] || null,
  }));

  return {
    tournament: {
      id: tournament._id,
      name: tournament.name,
    },
    table: populatedTable,
    asOfMatchday: upToMatchday,
    lastUpdated: new Date(),
  };
};
