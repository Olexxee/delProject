import Match from "./matchSchema.js";

// Create a match document
export const createMatch = async (payload) => {
  const match = new Match(payload);
  return await match.save();
};

// Get match by id
export const findMatchById = async (matchId) => {
  return await Match.findById(matchId)
    .populate("participants.userId", "username profilePicture")
    .populate("tournamentId")
    .exec();
};

// Update match (generic)
export const updateMatch = async (matchId, updateData) => {
  return await Match.findByIdAndUpdate(matchId, updateData, { new: true })
    .populate("participants.userId", "username profilePicture")
    .exec();
};

// Delete match
export const deleteMatch = async (matchId) => {
  return await Match.findByIdAndDelete(matchId);
};

// Find matches for a tournament
export const findMatchesByTournament = async (tournamentId) => {
  return await Match.find({ tournamentId })
    .populate("participants.userId", "username profilePicture")
    .sort({ matchday: 1, createdAt: 1 })
    .exec();
};

// Find open/closed match by fixture mapping
export const findMatchByTeams = async ({ tournamentId, homeTeam, awayTeam }) => {
  return await Match.findOne({ tournamentId, homeTeam, awayTeam });
};
