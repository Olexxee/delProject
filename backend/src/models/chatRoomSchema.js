import mongoose from "mongoose";

const chatRoomSchema = new mongoose.Schema(
  {
    contextType: { type: String, required: true },
    contextId: { type: mongoose.Schema.Types.ObjectId, required: true },

    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    aesKey: {
      type: String,
      required: true,
      select: false, 
    },

    encryptionVersion: {
      type: Number,
      default: 1,
    },

    lastMessageAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("ChatRoom", chatRoomSchema);
