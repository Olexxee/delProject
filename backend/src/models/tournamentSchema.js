import mongoose from "mongoose";
import { nanoid } from "nanoid";

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["league", "cup", "hybrid"],
      default: "league",
    },
    description: { type: String, default: "" },

    tournamentCode: { type: String, unique: true },
    maxParticipants: { type: Number, default: 20, min: 4 },

    // Only store registration info
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        registeredAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["registered", "confirmed", "withdrawn"],
          default: "registered",
        },
      },
    ],

    // Settings
    settings: {
      pointsForWin: { type: Number, default: 3 },
      pointsForDraw: { type: Number, default: 1 },
      pointsForLoss: { type: Number, default: 0 },
      rounds: { type: String, enum: ["single", "double"], default: "single" },
    },

    registrationDeadline: { type: Date, required: true },
    isRegistrationOpen: { type: Boolean, default: true },

    // Lifecycle tracking
    startDate: Date,
    endDate: Date,
    totalMatches: { type: Number, default: 0 },
    completedMatches: { type: Number, default: 0 },
    currentMatchday: { type: Number, default: 0 },
    totalMatchdays: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["upcoming", "registration", "ongoing", "completed", "cancelled"],
      default: "registration",
    },

    // Precomputed metrics for Discover
    activeTournamentsCount: { type: Number, default: 0 },
    totalParticipantsCount: { type: Number, default: 0 },
    avgPoints: { type: Number, default: 0 },
    communityScore: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Indexes
tournamentSchema.index({ groupId: 1, status: 1 });
tournamentSchema.index({ tournamentCode: 1 }, { unique: true });

// Auto-generate code
tournamentSchema.pre("save", function (next) {
  if (!this.tournamentCode) this.tournamentCode = `T-${nanoid(8)}`;
  next();
});

export default mongoose.model("Tournament", tournamentSchema);
