import Group from "../groupLogic/groupSchema.js";

export const discoverGroups = async (currentUserId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const groups = await Group.find({
    privacy: "public",
    isActive: true,
    createdBy: { $ne: currentUserId },
  })
    .sort({ communityScore: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return groups;
};
