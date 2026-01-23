// notificationService.js
import logger from "../../lib/logger.js";
import * as notificationDb from "../../models/notificationSchemaService.js";
import { emailChannel } from "./emailChannel.js";
import { pushChannel } from "./pushChannel.js";
import { getSocketsByUserId } from "../socket/socketRegistry.js";
import { io } from "../../server/serverConfig.js";

/**
 * Send notification to a user via one or more channels.
 * Only sends in-app if the user has active sockets.
 */
export const sendNotification = async ({
  recipient,        // User ID
  sender = "system", // Optional sender
  type,             // Notification type
  title,
  message,
  channels = ["inApp"], // ["inApp", "email", "push"]
  meta = {},            // Additional payload or email info
}) => {
  const activeChannels = [];

  // ---------------------------
  // 1️⃣ In-app (WebSocket) channel
  // ---------------------------
  if (channels.includes("inApp")) {
    const sockets = getSocketsByUserId(recipient);
    if (sockets.length > 0) {
      sockets.forEach((socketId) => {
        io.to(socketId).emit(type, { sender, title, message, meta });
      });
      logger.info(`[Notification] Sent ${type} to user ${recipient} via in-app`);
      activeChannels.push("inApp");
    } else {
      logger.info(`[Notification] User ${recipient} offline, skipping in-app`);
    }
  }

  // ---------------------------
  // 2️⃣ Email channel
  // ---------------------------
  if (channels.includes("email") && meta?.email) {
    try {
      await emailChannel.send({ to: meta.email, type, payload: meta.payload });
      logger.info(`[Notification] Sent ${type} to user ${recipient} via email`);
      activeChannels.push("email");
    } catch (err) {
      logger.error(`[Notification] Email failed for ${recipient}:`, err.message);
    }
  }

  // ---------------------------
  // 3️⃣ Push notification channel
  // ---------------------------
  if (channels.includes("push") && Array.isArray(meta?.deviceTokens) && meta.deviceTokens.length > 0) {
    try {
      await pushChannel.send({ tokens: meta.deviceTokens, title, body: message, payload: meta.payload });
      logger.info(`[Notification] Sent ${type} to user ${recipient} via push`);
      activeChannels.push("push");
    } catch (err) {
      logger.error(`[Notification] Push failed for ${recipient}:`, err.message);
    }
  }

  // ---------------------------
  // 4️⃣ Persist notification in DB
  // ---------------------------
  try {
    await notificationDb.createNotification({
      recipient,
      sender,
      type,
      title,
      message,
      channels: activeChannels,
      meta,
    });
  } catch (err) {
    logger.error(`[Notification] Failed to persist notification for ${recipient}:`, err.message);
  }

  return { success: activeChannels.length > 0, activeChannels };
};

/**
 * Fetch notifications for a user
 */
export const getUserNotifications = async (userId, options = {}) => {
  return notificationDb.findNotificationsByRecipient(userId, options);
};

/**
 * Mark a single notification as read
 */
export const markNotificationRead = async (notificationId) => {
  const notification = await notificationDb.markNotificationRead(notificationId);
  if (!notification) throw new Error("Notification not found");
  return notification;
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsRead = async (userId) => {
  return notificationDb.markAllNotificationsRead(userId);
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId) => {
  const notification = await notificationDb.deleteNotificationById(notificationId);
  if (!notification) throw new Error("Notification not found");
  return notification;
};
