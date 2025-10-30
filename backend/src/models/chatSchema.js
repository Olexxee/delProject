import mongoose from "mongoose";

const chatRoomSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Dynamic context (Match, Buddy, Event, Mart, Group)
    contextType: {
      type: String,
      enum: ["Match", "Buddy", "Event", "Mart", "Group"],
      required: true,
    },
    contextId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "contextType",
      required: true,
    },

    // Optional extras
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    mutedUntil: {
      type: Date,
      default: null,
    },
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const ChatRoom = mongoose.model("Chat", chatRoomSchema);
export default ChatRoom;
