import { Router } from "express";
import authMiddleware from "../middlewares/authenticationMdw.js";
import {
  signUp,
  login,
  getUser,
  sendVerificationEmail,
  verifyEmail,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
} from "../auth/authController.js";

const router = Router();

router.post("/signup", signUp);
router.post("/signin", login);
router.get("/user", authMiddleware, getUser);
router.patch("/send-verification-email", authMiddleware, sendVerificationEmail);
router.post("/verify-email", authMiddleware, verifyEmail);
router.patch("/change-password", authMiddleware, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", authMiddleware, logout);

export const authRoute = router;
