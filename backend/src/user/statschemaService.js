import UserStats from "./userStatSchema.js";

export const createUserStats = async ({
  user,
  group,
  tournamentsPlayedin = null,
}) => {
  return await UserStats.create({
    user,
    group,
    tournamentsPlayedin,
  });
};

export const updateUserStats = (userId, groupId, updates) =>
  UserStats.findOneAndUpdate(
    { user: userId, group: groupId },
    { ...updates, lastUpdated: Date.now() },
    { new: true }
  );

export const findByUserAndGroup = (userId, groupId) =>
  UserStats.findOne({ user: userId, group: groupId });

export const getUserStatsByGroup = (groupId) =>
  UserStats.find({ group: groupId }).populate("user", "username");

export const getUserStatsByUser = (userId) =>
  UserStats.find({ user: userId }).populate("group", "name");

export const deleteUserStats = (userId, groupId) =>
  UserStats.findOneAndDelete({ user: userId, group: groupId });

// Find stats for a user in a group and tournament
export const findByUserGroupAndTournament = (userId, groupId, tournamentId) =>
  UserStats.findOne({
    user: userId,
    group: groupId,
    tournamentsPlayedin: tournamentId,
  });

// Get all stats for a group within a specific tournament
export const getGroupStatsByTournament = (groupId, tournamentId) =>
  UserStats.find({
    group: groupId,
    tournamentsPlayedin: tournamentId,
  }).populate("user", "username");

// Get all tournament stats for a user
export const getUserTournamentStats = (userId, tournamentId) =>
  UserStats.find({
    user: userId,
    tournamentsPlayedin: tournamentId,
  }).populate("group", "name");
