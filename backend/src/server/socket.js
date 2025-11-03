export const initChatSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // 🗨️ Chat Events
    socket.on("join_chat", (chatId) => {
      socket.join(chatId);
      console.log(`📥 User joined chat ${chatId}`);
    });

    socket.on("leave_chat", (chatId) => {
      socket.leave(chatId);
      console.log(`📤 User left chat ${chatId}`);
    });

    socket.on("typing", (chatId) => socket.to(chatId).emit("typing", chatId));
    socket.on("stop_typing", (chatId) =>
      socket.to(chatId).emit("stop_typing", chatId)
    );

    // 🎮 Tournament Events
    socket.on("join_tournament", (tournamentId) => {
      socket.join(`tournament_${tournamentId}`);
      console.log(`🏆 User joined tournament room: ${tournamentId}`);
    });

    socket.on("leave_tournament", (tournamentId) => {
      socket.leave(`tournament_${tournamentId}`);
      console.log(`🚪 User left tournament room: ${tournamentId}`);
    });

    socket.on("tournament_update", ({ tournamentId, data }) => {
      io.to(`tournament_${tournamentId}`).emit("tournament_update", data);
      console.log(`📡 Tournament ${tournamentId} updated:`, data);
    });

    socket.on("disconnect", () => {
      console.log("🔴 User disconnected:", socket.id);
    });
  });
};
