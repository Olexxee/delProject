import logger from "../../lib/logger.js";
import { Router } from "express";
import * as notificationController from "../../logic/notifications/notificationController.js";
import { authMiddleware } from "../../middlewares/authenticationMdw.js";

const notificationRouter = Router();

// All routes require authentication
notificationRouter.use(authMiddleware);

notificationRouter.get("/", notificationController.getNotifications); // GET /notifications?unread=true
notificationRouter.post("/read/:id", notificationController.markRead); // POST /notifications/read/:id
notificationRouter.post("/read-all", notificationController.markAllRead); // POST /notifications/read-all
notificationRouter.delete("/:id", notificationController.deleteNotification); // DELETE /notifications/:id

export default notificationRouter;
