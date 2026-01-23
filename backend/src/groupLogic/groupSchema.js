import { Schema, model, Types } from "mongoose";
import { nanoid } from "nanoid";
import { group } from "node:console";

const GroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    bio: {
      type: String,
      default: "",
    },

    avatar: {
      type: String,
      default: "",
    },

    privacy: {
      type: String,
      enum: ["public", "private", "protected"],
      default: "public",
    },

    joinCode: {
      type: String,
      sparse: true,
      unique: true,
    },

    createdBy: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    totalMembers: {
      type: Number,
      default: 1,
    },

    tournamentsCount: {
      type: Number,
      default: 0,
    },

    activeTournamentsCount: {
      type: Number,
      default: 0,
    },
    chatRoom: { type: Types.ObjectId, ref: "ChatRoom", required: false },
    lastTournamentAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

export default model("Group", GroupSchema);
