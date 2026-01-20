import { Schema, model, Types } from "mongoose";

const FixtureSummarySchema = new Schema(
  {
    fixtureId: { type: Types.ObjectId, ref: "Fixture", required: true },
    opponent: { type: Types.ObjectId, ref: "User", required: true },
    homeOrAway: { type: String, enum: ["home", "away"], required: true },
    goalsFor: { type: Number, default: 0 },
    goalsAgainst: { type: Number, default: 0 },
    result: { type: String, enum: ["win", "loss", "draw"], required: true },
    matchday: { type: Number, required: true },
    scheduledDate: { type: Date },
    status: { type: String, enum: ["scheduled", "in_progress", "completed"] },
  },
  { _id: false }
);

const TournamentStatsSchema = new Schema(
  {
    tournamentId: { type: Types.ObjectId, ref: "Tournament", required: true },
    matchesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    goalsScored: { type: Number, default: 0 },
    goalsConceded: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    rank: { type: Number, default: 0 },
    fixtures: [FixtureSummarySchema],
  },
  { _id: false }
);

const UserStatsSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true },
    group: { type: Types.ObjectId, ref: "Group", required: true },
    tournamentsPlayedIn: [TournamentStatsSchema],
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for fast tournament lookup per user
UserStatsSchema.index(
  { user: 1, group: 1, "tournamentsPlayedIn.tournamentId": 1 },
  { unique: true }
);

export default model("UserStats", UserStatsSchema);
