import logger from "../../lib/logger.js";
import * as notificationDb from "../../models/notificationSchemaService.js";
import { pushChannel } from "./pushChannel.js";
import { emailChannel } from "./emailChannel.js";
import { inAppChannel } from "./inAppChannel.js";
import { channelMap } from "./channelMap.js";

/**
 * Unified notification service
 */
export const sendNotification = async ({
  recipient,
  sender,
  type,
  title,
  message,
  meta = {},
  channels, // optional override
  attachments = [],
  inlineImages = [],
  enableFallback = false, // try email if push fails
}) => {
  // Normalize sender
  let formattedSender = null;

  // Explicit system sender
  if (sender === "system") {
    formattedSender = { kind: "System", item: null };
  }
  // ObjectId or string userId
  else if (typeof sender === "string") {
    formattedSender = { kind: "User", item: sender };
  }
  // Mongoose doc or raw ObjectId
  else if (sender?._id) {
    formattedSender = { kind: "User", item: sender._id };
  }
  // Already formatted
  else if (sender?.kind) {
    formattedSender = sender;
  }

  // Persist notification in DB
  const notification = await notificationDb.createNotification({
    recipient,
    sender: formattedSender,
    type,
    title,
    message,
    meta,
  });

  // Resolve channels: use override → channel map → fallback
  const resolvedChannels = channels ||
    channelMap[type] || ["inApp", "push", "email"];

  // Dispatch to each channel
  for (const ch of resolvedChannels) {
    if (ch === "inApp") {
      try {
        await inAppChannel.send({ recipient, notification });
      } catch (err) {
        logger.warn(
          `In-app delivery failed for recipient ${recipient}: ${err.message}`
        );
        // Do NOT throw — just continue
      }
    }

    if (ch === "push") {
      const tokens =
        meta.deviceTokens ||
        notification.recipient?.deviceTokens ||
        meta.deviceToken ||
        notification.recipient?.deviceTokens || 
        [];

      if (tokens) {
        try {
          await pushChannel.send({
            recipientToken: tokens,
            title,
            message,
            meta: { type, ...meta },
          });
        } catch (err) {
          logger.error("Push failed:", err.message);
          console.log(err.message);

          if (enableFallback) {
            const email = meta.email || notification.recipient?.email;
            if (email) {
              try {
                await emailChannel.send({
                  to: email,
                  type,
                  payload: { title, message },
                  attachments,
                  inlineImages,
                  meta,
                });
              } catch (emailErr) {
                logger.error("Email fallback failed:", emailErr.message);
              }
            }
          }
        }
      }
    }

    if (ch === "email") {
      const email = meta.email || notification.recipient?.email;
      if (email) {
        try {
          await emailChannel.send({
            to: email,
            type,
            payload: { title, message },
            attachments,
            inlineImages,
            meta,
          });
        } catch (err) {
          logger.error("Email send failed:", err.message);
        }
      }
    }
  }

  return notification;
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (userId, options = {}) => {
  return notificationDb.findNotificationsByRecipient(userId, options);
};

/**
 * Mark notification as read
 */
export const markNotificationRead = async (notificationId) => {
  const notification = await notificationDb.markNotificationRead(
    notificationId
  );
  if (!notification) {
    throw new Error("Notification not found");
  }
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
  const notification = await notificationDb.deleteNotificationById(
    notificationId
  );
  if (!notification) {
    throw new Error("Notification not found");
  }
  return notification;
};
