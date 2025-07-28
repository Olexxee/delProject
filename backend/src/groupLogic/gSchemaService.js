import Group from "../groupLogic/groupSchema.js";

// Create a new group
export const createGroup = async (payload) => {
  return await Group.create(payload);
};

// Get a group by ID
export const findGroupById = async (groupId) => {
  return await Group.findById(groupId);
};

// db/groupDb.js
export const findGroupByName = async (groupName) => {
  const name = groupName.trim();
  const regex = new RegExp(`^${name}$`, "i");
  return await Group.findOne({ groupName: regex });
};

// Get group by joinCode
export const findGroupByJoinCode = async (joinCode) => {
  return await Group.findOne({ joinCode });
};

// Get all groups created by a user
export const findGroupsCreatedByUser = async (userId) => {
  return await Group.find({ createdBy: userId });
};

// Update group details
export const updateGroup = async (groupId, updatePayload) => {
  return await Group.findByIdAndUpdate(groupId, updatePayload, { new: true });
};

// Delete group
export const deleteGroup = async (groupId) => {
  return await Group.findByIdAndDelete(groupId);
};
