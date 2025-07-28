import Membership from "./membershipSchema.js";

// Create membership
export const createMembership = async (payload) => {
  return await Membership.create(payload);
};

// Find a user's membership in a group
export const findMembership = async ({ userId, groupId }) => {
  return await Membership.findOne({ userId, groupId });
};

// Get all users in a group
export const findAllMembersInGroup = async (groupId) => {
  return await Membership.find({ groupId }).populate(
    "userId",
    "username email profilePicture"
  );
};

// Get all groups a user belongs to
export const findGroupsByUser = async (filter) => {
  return await Membership.find(filter)
    .populate("groupId")
    .select("groupId roleInGroup");
};

// Update a user's membership (role, status, etc.)
export const updateMembership = async ({ userId, groupId }, updatePayload) => {
  return await Membership.findOneAndUpdate({ userId, groupId }, updatePayload, {
    new: true,
  });
};

// Remove user from group
export const removeMembership = async ({ userId, groupId }) => {
  return await Membership.findOneAndDelete({ userId, groupId });
};
