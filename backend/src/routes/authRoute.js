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

// ================= AUTH =================
router.post("/signup", signUp);
router.post("/signin", login);

// ================= USER =================
router.get("/user", authMiddleware, getUser);
router.patch("/change-password", authMiddleware, changePassword);

// ================= VERIFICATION =================
router.patch("/send-verification-email", authMiddleware, sendVerificationEmail);
router.post("/verify-email", verifyEmail);

// ================= PASSWORD RESET =================
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// ================= LOGOUT =================
router.post("/logout", authMiddleware, logout);

export const authRoute = router;
