import logger from "../lib/logger.js";
import multer from "multer";

// In-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * Centralized media upload tunnel for all app types
 * @param {string} type - "store" | "catalog" | "profile" | "event"
 */
export const handleMediaUpload = (type) => {
  let maxCount = 1; // default
  if (type === "catalog") maxCount = 3;
  if (type === "profile") maxCount = 5;
  if (type === "event") maxCount = 10;
  if (type === "store") maxCount = 5;
  if (type === "ask") maxCount = 3;
  if (type === "timeline") maxCount = 10; // Allow multiple images for timeline posts

  return upload.array("images", maxCount);
};
