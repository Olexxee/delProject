import express from "express";
import * as statsController from "../controllers/userStatsController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:userId", authMiddleware, statsController.getPlayerStats);
router.patch("/:userId/reset", authMiddleware, statsController.resetStats);
router.delete("/:userId", authMiddleware, statsController.deleteStats);

export default router;
