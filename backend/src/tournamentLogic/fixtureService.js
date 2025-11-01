import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import {
  NotFoundException,
  BadRequestError,
  ConflictException,
} from "../lib/classes/errorClasses.js";

import { generateLeagueFixtures } from "./generators/league.js";
import { generateCupFixtures } from "./generators/cupGenerator.js";
import { generateHybridFixtures } from "./generators/hybridGenerator.js";
import * as tableService from "./tableService.js"; // used for league/hybrid table updates

// -----------------------------
// MAIN — Generate Fixtures for Any Tournament Type
// -----------------------------
export const generateTournamentFixtures = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  // Verify admin rights
  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  // Ensure enough participants
  if (tournament.currentParticipants < 4)
    throw new BadRequestError("Tournament needs at least 4 participants");

  // Prevent duplicate fixtures
  const existing = await fixtureDb.fixturesExist(tournamentId);
  if (existing) throw new ConflictException("Fixtures already exist");

  // Check phase
  if (tournament.status !== "registration")
    throw new BadRequestError("Can only generate fixtures during registration");

  // Get participants
  const participants = tournament.participants
    .filter((p) => p.status === "registered")
    .map((p) => p.userId._id || p.userId);

  if (participants.length < 4)
    throw new BadRequestError("Not enough participants to generate fixtures");

  // Dispatch by tournament.type (use generators)
  let fixtures = [];
  switch (tournament.type) {
    case "league":
      fixtures = await generateLeagueFixtures(tournament, participants);
      break;
    case "cup":
      fixtures = await generateCupFixtures(tournament, participants);
      break;
    case "hybrid":
      fixtures = await generateHybridFixtures(tournament, participants);
      break;
    default:
      throw new BadRequestError("Invalid tournament type");
  }

  // Save fixtures
  const createdFixtures = await fixtureDb.createFixtures(fixtures);

  // Update tournament
  await tournamentDb.updateTournament(tournamentId, {
    status: "upcoming",
    totalMatchdays: Math.max(...fixtures.map((f) => f.matchday || 1)),
    currentMatchday: 1,
  });

  return {
    message: "Fixtures generated successfully",
    count: createdFixtures.length,
    type: tournament.type,
    fixtures: createdFixtures,
  };
};

// -----------------------------
// HANDLE PROGRESSION: Called when a fixture is completed
// - This function should be called right after you mark a fixture as completed
//   (e.g., in your match save hook or in the controller after updating fixture).
// -----------------------------
export const handleFixtureCompletion = async (fixtureId) => {
  const fixture = await fixtureDb.findFixtureById(fixtureId);
  if (!fixture) throw new NotFoundException("Fixture not found");

  if (!fixture.isCompleted) {
    // nothing to do
    return { message: "Fixture not completed — no progression performed" };
  }

  const tournament = await tournamentDb.findTournamentById(fixture.tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  // Branch by tournament type
  switch (tournament.type) {
    case "league":
      // update league table/stats
      await tableService.updateLeagueTableFromFixture(fixture);
      // optional: emit socket update from controller where this is called
      break;

    case "cup":
      await _handleCupProgression(fixture, tournament);
      break;

    case "hybrid":
      await _handleHybridProgression(fixture, tournament);
      break;

    default:
      break;
  }

  return { message: "Progression handled", tournamentId: fixture.tournamentId };
};

// -----------------------------
// CUP progression helpers
// - When an entire round is completed, collect winners and generate next round fixtures.
// - If only one winner remains, finalize tournament.
// -----------------------------
const _handleCupProgression = async (fixture, tournament) => {
  // Determine winner for this fixture (expect result or homeGoals/awayGoals)
  const winner =
    fixture.result?.winner ||
    (fixture.homeGoals > fixture.awayGoals ? fixture.homeTeam : fixture.awayTeam);

  // Update this fixture's result winner field if not already set
  if (!fixture.result || !fixture.result.winner) {
    await fixtureDb.updateFixtureResult(fixture._id, {
      ...fixture.toObject().result,
      winner,
    });
  }

  // Check all fixtures in the same round
  const allFixtures = await fixtureDb.getTournamentFixtures(tournament._id);
  const roundValue = fixture.round;
  const roundFixtures = allFixtures.filter((f) => f.round === roundValue);

  const isRoundCompleted = roundFixtures.length > 0 && roundFixtures.every((f) => f.isCompleted);

  if (!isRoundCompleted) return; // wait for remaining matches

  // Collect winners
  const winners = roundFixtures.map((f) => {
    if (f.result?.winner) return f.result.winner;
    return f.homeGoals > f.awayGoals ? f.homeTeam : f.awayTeam;
  });

  // If only one winner -> tournament finished
  const activeWinners = winners.filter(Boolean);
  if (activeWinners.length === 1) {
    await tournamentDb.updateTournament(tournament._id, {
      status: "completed",
      winner: activeWinners[0],
      completedAt: new Date(),
    });
    return;
  }

  // Build next round fixtures pairing winners
  const nextRound = _nextRoundLabel(roundValue, activeWinners.length);
  const newFixtures = [];
  for (let i = 0; i < activeWinners.length; i += 2) {
    if (activeWinners[i + 1]) {
      newFixtures.push({
        tournamentId: tournament._id,
        round: nextRound,
        matchday: tournament.currentMatchday + 1,
        homeTeam: activeWinners[i],
        awayTeam: activeWinners[i + 1],
        type: "cup",
      });
    } else {
      // bye - auto-advance
      newFixtures.push({
        tournamentId: tournament._id,
        round: nextRound,
        matchday: tournament.currentMatchday + 1,
        homeTeam: activeWinners[i],
        bye: true,
        isCompleted: true,
        result: { winner: activeWinners[i] },
        type: "cup",
      });
    }
  }

  // Save next round fixtures
  await fixtureDb.createFixtures(newFixtures);

  // bump matchday
  await tournamentDb.updateTournament(tournament._id, {
    currentMatchday: (tournament.currentMatchday || 1) + 1,
    totalMatchdays: Math.max(tournament.totalMatchdays || 0, tournament.currentMatchday + 1),
  });
};

// Helper to create next round label (simple approach)
const _nextRoundLabel = (currentRoundLabel, numTeamsRemaining) => {
  // if numeric round (e.g., 1) we just return current+1
  if (typeof currentRoundLabel === "number") return currentRoundLabel + 1;

  // If string like "Round of 16" -> build next ("Quarterfinal", "Semifinal", "Final")
  // Fallback logic:
  const match = /Round of (\d+)/i.exec(currentRoundLabel + "");
  if (match) {
    const next = Math.ceil(parseInt(match[1], 10) / 2);
    return `Round of ${next}`;
  }
  // Fallback numeric increment
  return `${currentRoundLabel}_next`;
};

// -----------------------------
// HYBRID progression helpers
// - Hybrid = group (league) stage followed by knockout.
// - After group fixtures complete, pick top N per group and generate cup fixtures.
// -----------------------------
const _handleHybridProgression = async (fixture, tournament) => {
  // 1) update group/league stats for this fixture
  await tableService.updateLeagueTableFromFixture(fixture);

  // 2) Check if all group-stage fixtures are completed
  const allFixtures = await fixtureDb.getTournamentFixtures(tournament._id);

  // If your hybrid generator tags group fixtures with `type: "group"` or `group: "Group X"`,
  // filter accordingly. We'll assume group fixtures have `type === "group"`
  const groupFixtures = allFixtures.filter((f) => f.type === "group");
  const isGroupStageComplete = groupFixtures.length > 0 && groupFixtures.every((f) => f.isCompleted);

  if (!isGroupStageComplete) return; // still in group stage

  // 3) Only run knockout generation once
  if (tournament.knockoutStarted) return;

  // 4) Determine qualified teams (using tableService)
  const table = await tableService.generateLeagueTable(tournament._id);
  // pick top half (or apply group-specific logic if groups exist)
  const qualified = table
    .slice(0, Math.ceil(table.length / 2))
    .map((row) => row.userId || row.teamId || row.user); // adapt to your table shape

  // 5) Generate cup fixtures for qualified teams
  const nextFixtures = await generateCupFixtures(tournament, qualified);

  // Save new fixtures
  await fixtureDb.createFixtures(nextFixtures);

  // Mark tournament as having started knockout
  await tournamentDb.updateTournament(tournament._id, {
    knockoutStarted: true,
    currentMatchday: (tournament.currentMatchday || 1) + 1,
  });
};

// -----------------------------
// Existing helpers: getters, regenerate, start, etc.
// -----------------------------
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
    knockoutStarted: false,
  });

  // Generate new fixtures
  return await generateTournamentFixtures({ tournamentId, userId });
};

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
