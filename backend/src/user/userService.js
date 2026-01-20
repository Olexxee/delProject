import User from "./userSchema.js";
import { serializeUser } from "../lib/serializeUser.js";
import UserStats from "../user/userStatSchema.js";

export const createUser = async (payload) => {
  const user = await User.create(payload);
  return user;
};

export const findUser = async (payload) => {
  return await User.findOne(payload);
};

export const findUserByEmail = async ({ email }) => {
  return User.findOne({ email });
};

export const findUserWithVerificationFields = async ({ email }) => {
  return User.findOne({ email }).select(
    "+verificationCode +verificationCodeExpiresAt"
  );
};

export const getUserProfile = async (userId) => {
  // Fetch basic user info
  const user = await User.findById(userId)
    .select(
      "-password -verificationCode -verificationCodeValidation -verificationCodeExpiresAt"
    )
    .lean();

  if (!user) throw new Error("User not found");

  // Fetch tournament-specific stats
  const stats = await UserStats.find({ user: userId })
    .populate("tournamentsPlayedIn.tournamentId", "name status settings")
    .populate("tournamentsPlayedIn.fixtures.opponent", "username profilePicture")
    .lean();

  // Serialize user with Delyx-style enrichment
  return serializeUser(user, stats.flatMap((s) => s.tournamentsPlayedIn));
};




export const findAndUpdateUserById = async (id, updateData) => {
  return await User.findByIdAndUpdate(id, updateData, {
    new: true,
  });
};

export const findUserByUsername = async ({ username }) => {
  const user = await User.findOne({ username });
  return user;
};

export const findUserById = async (id) => {
  return await User.findById(id);
};

export const findUserByIdAndUpdate = async (id, updateData) => {
  return await User.findByIdAndUpdate(id, updateData, {
    new: true, // Return the updated document
  });
};


export const addGroupToUser = async ({ userId, groupId }) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      $addToSet: { groups: groupId },
      $inc: { groupsJoinedCount: 1 },
    },
    { new: true }
  );
};

export const updateUser = async (payload) => {
  return await User.findByIdAndUpdate(payload.id, payload, { new: true });
};

export const deleteUser = async (payload) => {
  return await User.findByIdAndDelete(payload.id);
};

export const updateUserByEmail = async (email, updateData) => {
  const updatedUser = await User.findOneAndUpdate({ email }, updateData, {
    new: true,
    runValidators: true,
  });

  return updatedUser;
};

export const timesFlaggedUser = async (payload) => {
  const user = await User.findById(payload.id);
  return await User.findByIdAndUpdate(
    userId,
    { $inc: { timesKicked: 1 } },
    { new: true }
  );
};
