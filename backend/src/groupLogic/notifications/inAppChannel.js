export const inAppChannel = {
  send: async ({ recipient, notification }) => {
    try {
      const socketId = global._userSocketMap?.get(recipient.toString());

      if (!socketId || !global._io) {
        throw new Error("No active WebSocket connection for recipient");
      }

      global._io.to(socketId).emit("new_notification", notification);

      console.info("In-app notification sent to:", recipient);

      return { success: true, recipient };
    } catch (error) {
      console.log("In-app channel error:", error);
      throw error;
    }
  },
};
