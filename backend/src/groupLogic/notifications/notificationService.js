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
  let formattedSender = sender;
  if (sender && typeof sender === "string") {
    formattedSender = { kind: "User", item: sender };
  } else if (sender && !sender.kind) {
    formattedSender = { kind: "User", item: sender };
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
        console.log(
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
        notification.recipient?.deviceToken;

      if (tokens) {
        try {
          await pushChannel.send({
            recipientToken: tokens,
            title,
            message,
            meta: { type, ...meta },
          });
        } catch (err) {
          console.log("Push failed:", err.message);

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
                console.log("Email fallback failed:", emailErr.message);
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
          console.log("Email send failed:", err.message);
        }
      }
    }
  }

  return notification;
};
