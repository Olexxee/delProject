import mongoose from "mongoose";

const fixtureSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
    },
    matchday: {
      type: Number,
      required: true,
    },
    homeTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      default: null, // Populated when match is created
    },
    scheduledDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "postponed"],
      default: "scheduled",
    },
    homeScore: {
      type: Number,
      default: null,
    },
    awayScore: {
      type: Number,
      default: null,
    },
    // Football-specific data
    homeGoals: {
      type: Number,
      default: 0,
    },
    awayGoals: {
      type: Number,
      default: 0,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
fixtureSchema.index({ tournamentId: 1, matchday: 1 });
fixtureSchema.index(
  { tournamentId: 1, homeTeam: 1, awayTeam: 1 },
  { unique: true }
);
fixtureSchema.index({ homeTeam: 1, awayTeam: 1, tournamentId: 1 });

export default mongoose.model("Fixture", fixtureSchema);
