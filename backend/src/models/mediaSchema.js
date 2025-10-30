import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true, 
    },
    type: {
      type: String,
      enum: ["image", "video", "audio", "document", "other"],
      default: "image",
    },
    usage: {
      type: String,
      enum: ["profile", "chat", "event", "general"],
      default: "general",
    },
    size: {
      type: Number,
      default: 0, // in bytes
    },
    expiresAt: {
      type: Date,
      default: null, // only chat media will have expiry
    },
    metadata: {
      width: Number,
      height: Number,
      format: String,
      duration: Number,
    },
  },
  { timestamps: true }
);

// Optional index for automatic cleanup
mediaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Media = mongoose.model("Media", mediaSchema);
export default Media;
