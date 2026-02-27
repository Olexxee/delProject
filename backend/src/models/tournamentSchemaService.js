import Tournament from "./tournamentSchema.js";

// Create tournament
export const createTournament = async (payload) => {
  return await Tournament.create(payload);
};

// Find tournament by ID
export const findTournamentById = async (tournamentId) => {
  return await Tournament.findById(tournamentId)
    .populate("createdBy", "username email")
    .populate("groupId", "groupName")
    .populate("participants.userId", "username email");
};

// Find tournaments by group
export const findTournamentsByGroup = async (groupId, status = null) => {
  if (groupId && typeof groupId === "object" && groupId.groupId) {
    status = groupId.status || status;
    groupId = groupId.groupId;
  }

  const query = { groupId };
  if (status) query.status = status;

  return await Tournament.find(query)
    .populate("createdBy", "username email")
    .sort({ createdAt: -1 });
};

// Find tournament by code
export const findTournamentByCode = async (tournamentCode) => {
  return await Tournament.findOne({ tournamentCode })
    .populate("createdBy", "username email")
    .populate("groupId", "groupName");
};

// Check if tournament name exists in group
export const findTournamentByNameInGroup = async (name, groupId) => {
  const regex = new RegExp(`^${name.trim()}$`, "i");
  return await Tournament.findOne({
    name: regex,
    groupId,
    status: { $ne: "cancelled" },
  });
};

// Update tournament
export const updateTournament = async (tournamentId, updatePayload) => {
  return await Tournament.findByIdAndUpdate(tournamentId, updatePayload, {
    new: true,
    runValidators: true,
  });
};

// Add participant to tournament
export const addParticipant = async (tournamentId, userId) => {
  return await Tournament.findByIdAndUpdate(
    tournamentId,
    {
      $push: { participants: { userId } },
      $inc: { currentParticipants: 1 },
    },
    { new: true },
  );
};

export const getUserRoleInTournament = async (tournamentId, userId) => {
  const tournament =
    await Tournament.findById(tournamentId).select("participants");
  if (!tournament) throw new NotFoundException("Tournament not found");
  const role = tournament.role;
  return role;
};

// Remove participant from tournament
export const removeParticipant = async (tournamentId, userId) => {
  return await Tournament.findByIdAndUpdate(
    tournamentId,
    {
      $pull: { participants: { userId } },
      $inc: { currentParticipants: -1 },
    },
    { new: true },
  );
};

// Get active tournaments for user
export const findUserActiveTournaments = async (userId) => {
  return await Tournament.find({
    "participants.userId": userId,
    status: { $in: ["registration", "ongoing"] },
  }).populate("groupId", "groupName");
};

// Check if user is already registered
export const findUserInTournament = async (tournamentId, userId) => {
  return await Tournament.findOne({
    _id: tournamentId,
    "participants.userId": userId,
    "participants.status": "registered",
  });
};

// Get tournament participants with details
export const getTournamentParticipants = async (tournamentId) => {
  return await Tournament.findById(tournamentId)
    .populate({
      path: "participants.userId",
      select: "username email profilePicture",
    })
    .select("participants currentParticipants maxParticipants");
};

// Update participant status
export const updateParticipantStatus = async (tournamentId, userId, status) => {
  return await Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      "participants.userId": userId,
    },
    {
      $set: { "participants.$.status": status },
    },
    { new: true },
  );
};

// Get tournaments user is registered in
export const findUserTournaments = async (
  userId,
  status = ["registered", "confirmed"],
) => {
  return await Tournament.find({
    "participants.userId": userId,
    "participants.status": { $in: status },
    status: { $in: ["registration", "ongoing"] },
  })
    .populate("groupId", "groupName")
    .select("name status startDate endDate currentMatchday totalMatchdays");
};

// Check tournament capacity
export const checkTournamentCapacity = async (tournamentId) => {
  const tournament = await Tournament.findById(tournamentId).select(
    "currentParticipants maxParticipants",
  );

  return {
    isFull: tournament.currentParticipants >= tournament.maxParticipants,
    availableSlots: tournament.maxParticipants - tournament.currentParticipants,
    ...tournament.toObject(),
  };
};
