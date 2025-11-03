import Match from "./matchSchema.js"; 

export const createMatch = async (payload) => {
  return await Match.create(payload);
};

export const findMatchById = async (id) => {
  return await Match.findById(id)
    .populate("participants.userId", "username profilePicture")
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture");
};

export const updateMatch = async (id, updates) => {
  return await Match.findByIdAndUpdate(id, updates, { new: true });
};

export const findMatchesByTournament = async (tournamentId) => {
  return await Match.find({ tournamentId })
    .populate("participants.userId", "username profilePicture")
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .sort({ createdAt: 1 });
};
