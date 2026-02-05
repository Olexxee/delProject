import mongoose from "mongoose";
import { encrypt } from "../lib/encryption.js";
import ChatRoom from "./chatRoomSchema.js";

const messageSchema = new mongoose.Schema(
  {
    chatRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    encryptedContent: { type: String },
    iv: { type: String },
    authTag: { type: String },
    media: [{ type: String }], // media IDs
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

export default mongoose.model("Message", messageSchema);

// Pre-save: encrypt content
messageSchema.pre("save", async function (next) {
  if (this.isNew && this.encryptedContent == null && this.content) {
    const room = await ChatRoom.findById(this.chatRoom).select("+aesKey");
    if (!room) throw new Error("Chat room not found");

    const encrypted = encrypt(this.content, room.aesKey);
    this.encryptedContent = encrypted.cipherText;
    this.iv = encrypted.iv;
    this.authTag = encrypted.authTag;
    this.content = undefined; // remove plaintext
  }
  next();
});
