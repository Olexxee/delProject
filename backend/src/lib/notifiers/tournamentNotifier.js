import * as notificationService from "../groupLogic/notifications/notificationService.js";
import { emitTournamentUpdate } from "../socket/chatSocket.js";

/**
 * notifyAndEmit
 * - Sends in-app/push/email via notificationService
 * - Emits realtime socket event to tournament room(s)
 */
export const notifyAndEmit = async ({
  tournamentId,
  recipients = [], // array of user ids or group id depending on channel usage
  notificationPayload = {}, // { user, type, title, message, referenceId, meta }
  socketEvent = null, // { type, payload } -> emit to `tournament_<tournamentId>`
}) => {
  // Persist/send notification for each recipient (non-blocking)
  try {
    // if recipients is a groupId or single user, you can adapt
    if (Array.isArray(recipients) && recipients.length) {
      await Promise.all(
        recipients.map((r) =>
          notificationService.sendNotification({
            recipient: r,
            ...notificationPayload,
          })
        )
      );
    } else if (notificationPayload.recipient) {
      // single recipient saved in payload
      await notificationService.sendNotification(notificationPayload);
    }
  } catch (err) {
    console.error("Notification dispatch error:", err);
  }

  // Emit realtime event
  if (socketEvent && tournamentId) {
    try {
      emitTournamentUpdate(tournamentId, socketEvent); // your existing socket wrapper
    } catch (err) {
      console.error("Socket emit error:", err);
    }
  }
};
