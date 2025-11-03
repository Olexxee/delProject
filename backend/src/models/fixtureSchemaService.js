import Fixture from "./fixtureSchema.js";

// Create fixtures in bulk
export const createFixtures = async (fixtures) => {
  return await Fixture.insertMany(fixtures);
};

// Get all fixtures for a tournament
export const getTournamentFixtures = async (tournamentId) => {
  return await Fixture.find({ tournamentId })
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .populate("matchId")
    .sort({ matchday: 1, createdAt: 1 });
};

// Get fixtures for specific matchday
export const getMatchdayFixtures = async (tournamentId, matchday) => {
  return await Fixture.find({ tournamentId, matchday })
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .populate("matchId")
    .sort({ createdAt: 1 });
};

// Get fixtures for a specific team
export const getTeamFixtures = async (tournamentId, teamId) => {
  return await Fixture.find({
    tournamentId,
    $or: [{ homeTeam: teamId }, { awayTeam: teamId }],
  })
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .populate("matchId")
    .sort({ matchday: 1 });
};

// Update fixture with match result
export const updateFixtureResult = async (fixtureId, resultData) => {
  return await Fixture.findByIdAndUpdate(
    fixtureId,
    {
      ...resultData,
      isCompleted: true,
      completedAt: new Date(),
      status: "completed",
    },
    { new: true }
  );
};

// Get completed fixtures
export const getCompletedFixtures = async (tournamentId) => {
  return await Fixture.find({ tournamentId, isCompleted: true })
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .sort({ completedAt: -1 });
};

// Get upcoming fixtures
export const getUpcomingFixtures = async (tournamentId, limit = 10) => {
  return await Fixture.find({
    tournamentId,
    isCompleted: false,
    status: "scheduled",
  })
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .sort({ matchday: 1, createdAt: 1 })
    .limit(limit);
};

// Check if fixtures exist for tournament
export const fixturesExist = async (tournamentId) => {
  const count = await Fixture.countDocuments({ tournamentId });
  return count > 0;
};

// Delete all fixtures for tournament
export const deleteAllFixtures = async (tournamentId) => {
  return await Fixture.deleteMany({ tournamentId });
};

// Get matchday statistics
export const getMatchdayStats = async (tournamentId, matchday) => {
  const stats = await Fixture.aggregate([
    { $match: { tournamentId, matchday } },
    {
      $group: {
        _id: null,
        totalFixtures: { $sum: 1 },
        completedFixtures: { $sum: { $cond: ["$isCompleted", 1, 0] } },
        totalGoals: { $sum: { $add: ["$homeGoals", "$awayGoals"] } },
      },
    },
  ]);

  return stats[0] || { totalFixtures: 0, completedFixtures: 0, totalGoals: 0 };
};

export const getFixturesByRound = async (tournamentId, round) => {
  return await Fixture.find({ tournamentId, round }).sort({ matchday: 1 });
};

// Get fixtures by "type" (e.g., group, cup)
export const getFixturesByType = async (tournamentId, type) => {
  return await Fixture.find({ tournamentId, type }).sort({ matchday: 1 });
};

// Efficiently find fixture by teams (bidirectional)
export const findByTeamsAndTournament = async (
  homeId,
  awayId,
  tournamentId
) => {
  return await Fixture.findOne({
    tournamentId,
    $or: [
      { homeTeam: homeId, awayTeam: awayId },
      { homeTeam: awayId, awayTeam: homeId },
    ],
  });
};

// Also expose findFixtureById if not present
export const findFixtureById = async (id) => {
  return await Fixture.findById(id)
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture");
};
