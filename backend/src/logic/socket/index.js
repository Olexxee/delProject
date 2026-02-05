import { Server } from "socket.io";
import { socketAuthMiddleware } from "./socketAuth.js";
import { registerSocket, unregisterSocket } from "./socketRegistry.js";
import { registerChatEvents } from "../chats/chatEvent.js";

export const initSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    console.log("New connection attempt:", socket.handshake.auth);
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;

    registerSocket(userId, socket.id);
    console.info(`[Socket] User ${userId} connected (${socket.id})`);

    registerChatEvents(io, socket);

    socket.on("disconnect", () => {
      unregisterSocket(userId, socket.id);
      console.info(`[Socket] User ${userId} disconnected (${socket.id})`);
    });
  });

  return io;
};
