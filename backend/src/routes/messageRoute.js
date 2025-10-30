import express from "express";
import {
  sendMessage,
  editMessage,
  deleteMessage,
} from "../groupLogic/message/messageController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { processMediaUpload, uploadMedia } from "../middlewares/handleMediaUpload.js";

const messageRouter = express.Router();

// Send message (peer or group)
messageRouter.post(
  "/send",
  authMiddleware,
  uploadMedia.single("file"),  // multer handles file parsing
  processMediaUpload,          // Firebase + DB creation
  sendMessage
);

//  Edit message
messageRouter.put("/:messageId", authMiddleware, editMessage);

//  Delete message
messageRouter.delete("/:messageId", authMiddleware, deleteMessage);

export default messageRouter;
