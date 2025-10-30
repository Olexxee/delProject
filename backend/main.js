import configService from "./src/lib/classes/configClass.js";
import dotenv from "dotenv";
import { server } from "./src/server/serverConfig.js";
import connectDB from "./src/lib/database.js";
import { initChatSocket } from "./src/server/chatSocket.js";
import path from "path";

dotenv.config();

(() => {
  try {
    const port = parseInt(configService.getOrThrow("PORT"));
    connectDB();
    initChatSocket();
    server.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
