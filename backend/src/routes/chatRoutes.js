import { Router } from "express";
import multer from "multer";
import * as chatController from "../../logic/chats/chatController.js";
import { authMiddleware } from "../../middlewares/authenticationMdw.js";
import { validateBody } from "../../middlewares/validatorMiddleware.js";
import { sendMessageSchema } from "../../logic/chats/chatRequest.js";

const chatRouter = Router();

// MULTER CONFIG
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "video/mp4"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// AUTHENTICATION
chatRouter.use(authMiddleware);

// CHAT ROOMS
chatRouter.get("/room/:contextType/:contextId", chatController.getChatRoom);
chatRouter.get("/rooms", chatController.getUserChatRooms);

// MESSAGES
chatRouter.get("/room/:chatRoomId/messages", chatController.getMessages);
chatRouter.get("/room/:chatRoomId/sync", chatController.syncMessages);

chatRouter.post(
  "/room/:chatRoomId/messages",
  upload.array("media", 5),
  validateBody(sendMessageSchema),
  chatController.sendMessage
);

// MESSAGE DELETION
chatRouter.delete("/messages/:messageId", chatController.deleteMessage);
chatRouter.delete(
  "/messages/:messageId/everyone",
  chatController.deleteMessageForEveryone
);

export default chatRouter;
