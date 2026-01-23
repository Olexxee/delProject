import mongoose from "mongoose";

export const messageSchema = new mongoose.Schema(
  {
    chatRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    encryptedContent: {
      type: String,
      required: true,
    },

    iv: {
      type: String,
      required: true,
    },

    authTag: {
      type: String,
      required: true,
    },

    media: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
      },
    ],

    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
messageSchema.index({ chatRoom: 1, createdAt: -1 });
messageSchema.index({ chatRoom: 1, deletedFor: 1 });

export const Message = mongoose.model("Message", messageSchema);
