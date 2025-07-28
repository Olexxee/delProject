import { Schema, model, Types } from "mongoose";

const UserStatsSchema = new Schema(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    tournamentsPlayedin: {
      type: Types.ObjectId,
      ref: "Tournament",
      default: null, // Optional for general group stats
    },
    group: {
      type: Types.ObjectId,
      ref: "Group",
      required: true,
    },
    matchesPlayed: {
      type: Number,
      default: 0,
    },
    wins: {
      type: Number,
      default: 0,
    },
    losses: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      default: 0,
    },
    rank: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Allow multiple stat records per group and tournament combo
UserStatsSchema.index(
  { user: 1, group: 1, tournamentsPlayedin: 1 },
  { unique: true }
);

const UserStats = model("UserStats", UserStatsSchema);
export default UserStats;
