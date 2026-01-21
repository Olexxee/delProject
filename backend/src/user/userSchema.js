import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";
import Group from "../groupLogic/groupSchema.js";
import configService from "../lib/classes/configClass.js";
import mongoose from "mongoose";
import UserStats from "./userStatSchema.js";

const UserSchema = new Schema(
  {
    username: {
      type: String,
      unique: true,
    },
    userStats: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserStats",
      default: null,
    },
    name: {
      type: String,
    },
    password: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    bio: {
      type: String,
    },
    profilePicture: {
      type: String,
      default: "Upload A picture",
    },
    verificationCode: {
      type: String,
      select: false,
    },
    verificationCodeValidation: {
      type: String,
      select: false,
    },
    verificationCodeExpiresAt: {
      type: Date,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["admin", "user", "superadmin"],
      default: "user",
    },
     deviceTokens: {
    type: [String], // Array to store multiple device tokens (iOS, Android, Web)
    default: [],
  },
  aesKey: { type: String, required: true },

    // === Group-related Metrics ===
    groupsCreatedCount: {
      type: Number,
      default: 0,
    },
    groupsJoinedCount: {
      type: Number,
      default: 0,
    },
    groups: {
      type: [String],
      default: [],
    },
    adminGroupsCount: {
      type: Number,
      default: 0,
    },
    timesKicked: {
      type: Number,
      default: 0,
    },
    timesBannedFromGroups: {
      type: Number,
      default: 0,
    },
    groupsCreated: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
      },
    ],
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(
      this.password,
      parseInt(configService.getOrThrow("SALT_ROUNDS"))
    );
  }
});

const User = model("User", UserSchema);
export default User;
