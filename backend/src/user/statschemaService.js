import UserStats from "./userStatSchema.js";

export const createUserStats = async ({
  user,
  group,
  tournamentsPlayedin,
  session,
}) => {
  const tournamentId = tournamentsPlayedin;
  return await UserStats.findOneAndUpdate(
    { user, group },
    {
      $setOnInsert: { user, group },
      $addToSet: {
        tournamentsPlayedIn: {
          tournamentId,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          goalsScored: 0,
          goalsConceded: 0,
          points: 0,
          rank: 0,
          fixtures: [],
        },
      },
    },
    {
      upsert: true,
      new: true,
      session: session ?? null,
    },
  );
};

// ================================
// UPDATE USER STATS
// ================================
export const updateUserStats = (userId, groupId, updates) =>
  UserStats.findOneAndUpdate(
    { user: userId, group: groupId },
    { ...updates, lastUpdated: Date.now() },
    { new: true },
  );

// ================================
// FINDERS
// ================================
export const findByUserAndGroup = (userId, groupId) =>
  UserStats.findOne({ user: userId, group: groupId });

export const getUserStatsByGroup = (groupId) =>
  UserStats.find({ group: groupId }).populate("user", "username");

export const getUserStatsByUser = (userId) =>
  UserStats.find({ user: userId }).populate("group", "name");

export const deleteUserStats = (userId, groupId) =>
  UserStats.findOneAndDelete({ user: userId, group: groupId });

// Find stats for a user in a specific tournament
export const findByUserGroupAndTournament = (userId, groupId, tournamentId) =>
  UserStats.findOne({
    user: userId,
    group: groupId,
    "tournamentsPlayedIn.tournamentId": tournamentId,
  });

// Get all stats for a group within a specific tournament
export const getGroupStatsByTournament = (groupId, tournamentId) =>
  UserStats.find({
    group: groupId,
    "tournamentsPlayedIn.tournamentId": tournamentId,
  }).populate("user", "username");

// Get all tournament stats for a user
export const getUserTournamentStats = (userId, tournamentId) =>
  UserStats.find({
    user: userId,
    "tournamentsPlayedIn.tournamentId": tournamentId,
  }).populate("group", "name");
