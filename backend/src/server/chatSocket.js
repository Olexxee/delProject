import { Server } from "socket.io";

let io;

// 🔌 Initialize socket server
export const initChatSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // later restrict this to your frontend URL
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // Join user-specific or chat-specific rooms
    socket.on("join_chat", (chatId) => {
      socket.join(chatId);
      console.log(`📥 User joined chat ${chatId}`);
    });

    // When a user leaves
    socket.on("leave_chat", (chatId) => {
      socket.leave(chatId);
      console.log(`📤 User left chat ${chatId}`);
    });

    // Typing indicators (optional)
    socket.on("typing", (chatId) => socket.to(chatId).emit("typing", chatId));
    socket.on("stop_typing", (chatId) =>
      socket.to(chatId).emit("stop_typing", chatId)
    );

    socket.on("disconnect", () => {
      console.log("🔴 User disconnected:", socket.id);
    });
  });
};

// 📨 Emit new message to connected clients
export const emitNewMessage = (chatId, message) => {
  if (!io) return;
  io.to(chatId).emit("new_message", message);
};
