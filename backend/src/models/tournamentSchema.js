import mongoose from "mongoose";
import { nanoid } from "nanoid";

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
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
    // === NEW FIELDS FOR LEAGUE TOURNAMENTS ===
    type: {
      type: String,
      enum: ["league", "cup", "hybrid"],
      default: "league",
    },
    description: {
      type: String,
      default: "",
    },
    tournamentCode: {
      type: String,
      unique: true,
    },
    maxParticipants: {
      type: Number,
      default: 20,
      min: 4,
    },
    currentParticipants: {
      type: Number,
      default: 0,
    },
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        registeredAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["registered", "confirmed", "withdrawn"],
          default: "registered",
        },
      },
    ],
    settings: {
      pointsForWin: {
        type: Number,
        default: 3,
      },
      pointsForDraw: {
        type: Number,
        default: 1,
      },
      pointsForLoss: {
        type: Number,
        default: 0,
      },
      rounds: {
        type: String,
        enum: ["single", "double"],
        default: "single",
      },
    },
    registrationDeadline: {
      type: Date,
      required: true,
    },
    isRegistrationOpen: {
      type: Boolean,
      default: true,
    },
    currentMatchday: {
      type: Number,
      default: 0,
    },
    totalMatchdays: {
      type: Number,
      default: 0,
    },
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ["upcoming", "registration", "ongoing", "completed", "cancelled"],
      default: "registration",
    },
  },
  { timestamps: true }
);

// Index for efficient queries
tournamentSchema.index({ groupId: 1, status: 1 });
tournamentSchema.index({ tournamentCode: 1 }, { unique: true });

// Generate unique tournament code
tournamentSchema.pre("save", function (next) {
  if (!this.tournamentCode) {
    this.tournamentCode = `T-${nanoid(8)}`;
  }
  next();
});

export default mongoose.model("Tournament", tournamentSchema);
