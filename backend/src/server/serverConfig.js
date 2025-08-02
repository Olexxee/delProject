import express from "express";
import cors from "cors";
import { authRoute } from "../routes/authRoute.js";
import { createServer } from "http";
import helmet from "helmet";
import configService from "../lib/classes/configClass.js";
import cookieParser from "cookie-parser";
import compression from "compression";
import { convertHumanReadableTimeToMilliseconds } from "../lib/utils.js";
import { postRoute } from "../routes/postRoutes.js";
import path from "path";
import userRoute from "../routes/userRoutes.js";
import router from "../routes/groupRoutes.js";
import membershipRouter from "../routes/membershipRoute.js";
import fixtureRouter from "../routes/fixturesRoute.js";
import tableRouter from "../routes/tableRoutes.js";
import tournamentRouter from "../routes/tournamentRoutes.js";
import participantRouter from "../routes/participantRoute.js";

const app = express();
const server = createServer(app);

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());
app.use(helmet());
app.use(compression());
app.use(cookieParser(configService.getOrThrow("COOKIE_SECRET")));
app.use(express.urlencoded({ extended: true }));

// Handle Global Errors
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack || err.message || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server error",
  });
});

// To serve static files, images or video
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// To serve the frontend build files
app.use("/api/profile", userRoute);
app.use("/api/auth", authRoute);
app.use("/api/posts", postRoute);
// app.use("/api/stats", statRoute);
app.use("/api/groups", router);
app.use("/api/membership", membershipRouter);
app.use("/api/tournaments", tournamentRouter);
app.use("/api/participants", participantRouter);
app.use("/api/fixtures", fixtureRouter);
app.use("/api/tables", tableRouter);

export { server };
