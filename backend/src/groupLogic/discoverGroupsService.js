import Group from "../groupLogic/groupSchema.js";
import Tournament from "../models/tournamentSchema.js";
import UserStats from "../user/userStatSchema.js";

/**
 * Discover groups based on community activity
 * @param {Object} options
 * @param {Number} options.limit - max groups to return
 * @param {Number} options.page - pagination
 * @returns {Array} groups with community-driven metrics
 */
export const discoverGroups = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;

  // 1️⃣ Fetch all public groups
  const groups = await Group.find({ privacy: "public", isActive: true })
    .select(
      "_id name avatar totalMembers tournamentsCount activeTournamentsCount lastTournamentAt",
    )
    .populate("avatar", "url") // populate the avatar document, only fetching the `url` field
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  // Map avatar to URL directly
  const groupsWithAvatarUrl = groups.map((g) => ({
    ...g,
    avatar: g.avatar?.url || null,
  }));

  if (!groupsWithAvatarUrl.length) return [];

  // 2️⃣ Aggregate tournament activity per group
  const groupIds = groups.map((g) => g._id);

  const tournamentAgg = await Tournament.aggregate([
    {
      $match: {
        groupId: { $in: groupIds },
        status: { $in: ["registration", "ongoing"] },
      },
    },
    {
      $group: {
        _id: "$groupId",
        activeTournaments: { $sum: 1 },
        totalParticipants: { $sum: { $size: "$participants" } },
      },
    },
  ]);

  const tournamentMap = new Map(
    tournamentAgg.map((t) => [t._id.toString(), t]),
  );

  // 3️⃣ Aggregate user participation (from UserStats)
  const userStatsAgg = await UserStats.aggregate([
    { $match: { group: { $in: groupIds } } },
    { $unwind: "$tournamentsPlayedIn" },
    {
      $group: {
        _id: "$group",
        activeUsers: { $sum: 1 },
        avgPoints: { $avg: "$tournamentsPlayedIn.points" },
      },
    },
  ]);

  const statsMap = new Map(userStatsAgg.map((s) => [s._id.toString(), s]));

  // 4️⃣ Compute communityScore for ranking
  const scoredGroups = groups.map((group) => {
    const t = tournamentMap.get(group._id.toString()) || {
      activeTournaments: 0,
      totalParticipants: 0,
    };
    const s = statsMap.get(group._id.toString()) || {
      activeUsers: 0,
      avgPoints: 0,
    };

    const participationRate = group.totalMembers
      ? s.activeUsers / group.totalMembers
      : 0;

    const communityScore =
      t.activeTournaments * 0.5 +
      participationRate * 0.3 +
      (s.avgPoints || 0) * 0.2; // weights: adjust as needed

    return {
      ...group,
      activeTournaments: t.activeTournaments,
      totalParticipants: t.totalParticipants,
      activeUsers: s.activeUsers,
      avgPoints: s.avgPoints,
      participationRate,
      communityScore,
    };
  });

  // 5️⃣ Sort by communityScore descending
  scoredGroups.sort((a, b) => b.communityScore - a.communityScore);

  // 6️⃣ Paginate
  return scoredGroups.slice(skip, skip + limit);
};
