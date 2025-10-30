import { Schema, model, Types } from "mongoose";
import { nanoid } from "nanoid";

const GroupSchema = new Schema(
  {
    groupName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
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
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    totalMembers: {
      type: Number,
      default: 1,
    },

    // ✅ Add these inside GroupSchema
    membersCount: {
      type: Number,
      default: 1,
    },
    // optional metadata
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// ensure group is searchable by lowercase name
GroupSchema.index({ groupName: "text", description: "text" });

// Generate a unique join code before saving the group
GroupSchema.pre("save", function (next) {
  if (!this.joinCode) {
    this.joinCode = nanoid(8);
  }
  next();
});

const Group = model("Group", GroupSchema);

export default Group;
