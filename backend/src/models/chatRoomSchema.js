import mongoose from "mongoose";
import { generateRoomKey } from "../logic/chats/chatRoomKeyService.js";

const chatRoomSchema = new mongoose.Schema(
  {
    contextType: { type: String, enum: ["group", "direct"], required: true },
    contextId: { type: mongoose.Schema.Types.ObjectId, required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    aesKey: { type: String, required: true, select: false },
    encryptionVersion: { type: Number, default: 1 },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

chatRoomSchema.pre("save", function (next) {
  if (!this.aesKey) {
    this.aesKey = generateRoomKey().toString("hex");
  }
  next();
});

export default mongoose.model("ChatRoom", chatRoomSchema);
