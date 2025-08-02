import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as userStatsService from "../user/statschemaService.js";
import { NotFoundException } from "../lib/classes/errorClasses.js";

// Generate complete league table
export const generateLeagueTable = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Get all participants
  const participants = tournament.participants
    .filter((p) => p.status === "registered")
    .map((p) => p.userId._id || p.userId);

  // Get all completed fixtures
  const completedFixtures = await fixtureDb.getCompletedFixtures(tournamentId);

  // Initialize table data for each participant
  const tableData = {};

  participants.forEach((participantId) => {
    tableData[participantId.toString()] = {
      userId: participantId,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [], // Last 5 results
      position: 0,
    };
  });

  // Process each completed fixture
  completedFixtures.forEach((fixture) => {
    const homeId = fixture.homeTeam._id.toString();
    const awayId = fixture.awayTeam._id.toString();
    const homeGoals = fixture.homeGoals || 0;
    const awayGoals = fixture.awayGoals || 0;

    // Update matches played
    tableData[homeId].matchesPlayed++;
    tableData[awayId].matchesPlayed++;

    // Update goals
    tableData[homeId].goalsFor += homeGoals;
    tableData[homeId].goalsAgainst += awayGoals;
    tableData[awayId].goalsFor += awayGoals;
    tableData[awayId].goalsAgainst += homeGoals;

    // Update goal difference
    tableData[homeId].goalDifference =
      tableData[homeId].goalsFor - tableData[homeId].goalsAgainst;
    tableData[awayId].goalDifference =
      tableData[awayId].goalsFor - tableData[awayId].goalsAgainst;

    // Determine result and update stats
    let homeResult, awayResult;
    if (homeGoals > awayGoals) {
      // Home win
      tableData[homeId].wins++;
      tableData[awayId].losses++;
      tableData[homeId].points += tournament.settings.pointsForWin;
      tableData[awayId].points += tournament.settings.pointsForLoss;
      homeResult = "W";
      awayResult = "L";
    } else if (homeGoals < awayGoals) {
      // Away win
      tableData[awayId].wins++;
      tableData[homeId].losses++;
      tableData[awayId].points += tournament.settings.pointsForWin;
      tableData[homeId].points += tournament.settings.pointsForLoss;
      homeResult = "L";
      awayResult = "W";
    } else {
      // Draw
      tableData[homeId].draws++;
      tableData[awayId].draws++;
      tableData[homeId].points += tournament.settings.pointsForDraw;
      tableData[awayId].points += tournament.settings.pointsForDraw;
      homeResult = "D";
      awayResult = "D";
    }

    // Update form (last 5 results)
    tableData[homeId].form.push(homeResult);
    tableData[awayId].form.push(awayResult);

    // Keep only last 5 results
    if (tableData[homeId].form.length > 5) {
      tableData[homeId].form = tableData[homeId].form.slice(-5);
    }
    if (tableData[awayId].form.length > 5) {
      tableData[awayId].form = tableData[awayId].form.slice(-5);
    }
  });

  // Convert to array and sort by league position
  const tableArray = Object.values(tableData);

  // Sort by: Points (desc), Goal Difference (desc), Goals For (desc), Head-to-head (if needed)
  tableArray.sort((a, b) => {
    // Points first
    if (b.points !== a.points) return b.points - a.points;

    // Goal difference second
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;

    // Goals for third
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

    // Head-to-head would go here (more complex)
    return 0;
  });

  // Assign positions
  tableArray.forEach((team, index) => {
    team.position = index + 1;
  });

  // Populate user details
  const populatedTable = await Promise.all(
    tableArray.map(async (team) => {
      const userDetails = await getUserDetails(team.userId);
      return {
        ...team,
        user: userDetails,
      };
    })
  );

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

// Get user details helper
const getUserDetails = async (userId) => {
  const User = (await import("../user/userSchema.js")).default;
  return await User.findById(userId).select("username email profilePicture");
};

// Get head-to-head record between two teams
export const getHeadToHeadRecord = async (tournamentId, team1Id, team2Id) => {
  const fixtures = await fixtureDb.getTournamentFixtures(tournamentId);

  const h2hFixtures = fixtures
    .filter(
      (fixture) =>
        (fixture.homeTeam._id.toString() === team1Id.toString() &&
          fixture.awayTeam._id.toString() === team2Id.toString()) ||
        (fixture.homeTeam._id.toString() === team2Id.toString() &&
          fixture.awayTeam._id.toString() === team1Id.toString())
    )
    .filter((fixture) => fixture.isCompleted);

  const record = {
    played: h2hFixtures.length,
    team1Wins: 0,
    team2Wins: 0,
    draws: 0,
    team1Goals: 0,
    team2Goals: 0,
    fixtures: h2hFixtures,
  };

  h2hFixtures.forEach((fixture) => {
    const isTeam1Home = fixture.homeTeam._id.toString() === team1Id.toString();
    const homeGoals = fixture.homeGoals || 0;
    const awayGoals = fixture.awayGoals || 0;

    if (isTeam1Home) {
      record.team1Goals += homeGoals;
      record.team2Goals += awayGoals;

      if (homeGoals > awayGoals) record.team1Wins++;
      else if (homeGoals < awayGoals) record.team2Wins++;
      else record.draws++;
    } else {
      record.team1Goals += awayGoals;
      record.team2Goals += homeGoals;

      if (awayGoals > homeGoals) record.team1Wins++;
      else if (awayGoals < homeGoals) record.team2Wins++;
      else record.draws++;
    }
  });

  return record;
};

// Get league table for specific matchday (historical view)
export const getHistoricalTable = async (tournamentId, upToMatchday) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  // Get fixtures up to specific matchday
  const fixtures = await fixtureDb.getTournamentFixtures(tournamentId);
  const historicalFixtures = fixtures.filter(
    (fixture) => fixture.matchday <= upToMatchday && fixture.isCompleted
  );

  // Use similar logic as generateLeagueTable but with filtered fixtures
  // Implementation similar to above but with historicalFixtures

  return {
    tournament: {
      id: tournament._id,
      name: tournament.name,
      matchday: upToMatchday,
    },
    table: [], // Would contain calculated table for that matchday
    asOfMatchday: upToMatchday,
  };
};

// Get mini league table (top/bottom teams)
export const getMiniTable = async (tournamentId, options = {}) => {
  const { top = 5, bottom = 3 } = options;

  const fullTable = await generateLeagueTable(tournamentId);

  return {
    ...fullTable,
    table: {
      top: fullTable.table.slice(0, top),
      bottom: fullTable.table.slice(-bottom),
    },
  };
};

// Get team's position and nearby teams
export const getTeamPosition = async (tournamentId, teamId) => {
  const fullTable = await generateLeagueTable(tournamentId);

  const teamIndex = fullTable.table.findIndex(
    (team) => team.userId.toString() === teamId.toString()
  );

  if (teamIndex === -1) {
    throw new NotFoundException("Team not found in tournament");
  }

  const team = fullTable.table[teamIndex];

  // Get teams above and below
  const context = {
    above:
      teamIndex > 0
        ? fullTable.table.slice(Math.max(0, teamIndex - 2), teamIndex)
        : [],
    team: team,
    below:
      teamIndex < fullTable.table.length - 1
        ? fullTable.table.slice(
            teamIndex + 1,
            Math.min(fullTable.table.length, teamIndex + 3)
          )
        : [],
  };

  return {
    tournament: fullTable.tournament,
    position: context,
  };
};
