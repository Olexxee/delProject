import { firebaseMessaging } from "../../firebase/firebaseAdminService.js";

export const pushChannel = {
  send: async ({ recipientToken, title, message, meta = {} }) => {
    if (!recipientToken) {
      throw new Error("Push notification failed: missing recipient token");
    }

    const tokens = Array.isArray(recipientToken)
      ? recipientToken
      : [recipientToken];

    try {
      const payload = {
        notification: { title, body: message },
        data: {
          type: meta.type || "general",
          ...Object.fromEntries(
            Object.entries(meta).map(([k, v]) => [k, String(v)])
          ),
        },
      };

      // Multicast send
      const response = await firebaseMessaging.sendMulticast({
        tokens,
        ...payload,
      });

      console.info("Push multicast result:", response);

      return { success: true, response };
    } catch (error) {
      console.log("Push notification error:", error);
      throw error;
    }
  },
};
