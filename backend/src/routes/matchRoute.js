import express from "express";
import * as matchController from "../controllers/matchController.js";
import { authMiddleware } from "../middlewares/authenticationMdw.js";

const matchRouter = express.Router();

matchRouter.post("/", authMiddleware, matchController.createMatch);
matchRouter.put("/:id/result", authMiddleware, matchController.submitResult);
matchRouter.get(
  "/tournament/:tournamentId",
  authMiddleware,
  matchController.getMatchesForTournament
);
matchRouter.get("/:id", authMiddleware, matchController.getMatchById);

export default matchRouter;
