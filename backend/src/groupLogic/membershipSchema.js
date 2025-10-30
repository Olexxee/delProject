import { Schema, model, Types } from "mongoose";

const MembershipSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    groupId: {
      type: Types.ObjectId,
      ref: "Group",
      required: true,
    },
    roleInGroup: {
      type: String,
      enum: ["admin", "moderator", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["active", "pending", "banned"],
      default: "active",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },

    invitedBy: {
      type: Types.ObjectId,
      ref: "User",
    },

    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// To avoid duplicate memberships
MembershipSchema.index({ userId: 1, groupId: 1 }, { unique: true });

const Membership = model("Membership", MembershipSchema);
export default Membership;
