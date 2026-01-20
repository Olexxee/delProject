import * as userService from "../user/userService.js";
import configService from "../lib/classes/configClass.js";
import {
  ConflictException,
  NotFoundException,
  ForbiddenError,
  BadRequestError,
  UnauthorizedException,
} from "../lib/classes/errorClasses.js";
import bcrypt from "bcrypt";
import transport from "../lib/classes/nodeMailerClass.js";
import jwtService from "../lib/classes/jwtClass.js";
import { serializeUser } from "../lib/serializeUser.js";
import crypto from "crypto";

/* ================= AUTHENTICATION ================= */

export const authenticateUser = async ({ email, password }) => {
  const user = await userService.findUserByEmail({ email });

  if (!user) throw new UnauthorizedException("Invalid credentials");

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) throw new UnauthorizedException("Invalid credentials");

  const token = jwtService.generateAuthenticationToken({
    id: user._id,
    email: user.email,
    role: user.role,
  });

  return { token, user: serializeUser(user) };
};

export const registerUser = async (payload) => {
  const existingUser = await userService.findUserByEmail({ email: payload.email });
  if (existingUser) throw new ConflictException("User already exists");

  const newUser = await userService.createUser(payload);

  const token = jwtService.generateAuthenticationToken({
    id: newUser._id,
    email: newUser.email,
    role: newUser.role,
  });

  return { token, user: serializeUser(newUser) };
};

/* ================= USER PROFILE ================= */

export const getUserProfile = async (email) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) throw new NotFoundException("User not found");
  return serializeUser(user);
};

export const updateUserProfile = async ({ email, ...updates }) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) throw new NotFoundException("User not found");
  if (!user.verified) throw new ForbiddenError("Only verified users can update profile");

  const updatedUser = await userService.updateUserByEmail(email, updates);
  return serializeUser(updatedUser);
};

/* ================= EMAIL VERIFICATION ================= */

export const sendVerificationEmail = async (email) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) throw new NotFoundException("User not found");
  if (user.verified) throw new BadRequestError("User already verified");

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  const info = await transport.sendMail({
    from: configService.getOrThrow("EMAIL"),
    to: user.email,
    subject: "Verification Code",
    text: `Your verification code is ${verificationCode}`,
  });

  if (!info.accepted.includes(user.email)) {
    throw new BadRequestError("Failed to send verification email");
  }

  user.verificationCode = await bcrypt.hash(verificationCode, 10);
  user.verificationCodeExpiresAt = Date.now() + 10 * 60 * 1000;
  await user.save();

  return { expiresIn: 10 }; // minutes
};

export const verifyUser = async (email, code) => {
  const user = await userService.findUserWithVerificationFields({ email });
  if (!user) throw new NotFoundException("User not found");

  if (user.verificationCodeExpiresAt < Date.now()) {
    throw new BadRequestError("Verification code expired");
  }

  const isValid = await bcrypt.compare(code, user.verificationCode);
  if (!isValid) throw new BadRequestError("Invalid verification code");

  user.verified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiresAt = undefined;
  await user.save();

  return serializeUser(user);
};

/* ================= PASSWORD MANAGEMENT ================= */

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await userService.findUserById(userId);
  if (!user) throw new NotFoundException("User not found");

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) throw new BadRequestError("Current password is incorrect");

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  return true;
};

export const forgotPassword = async (email) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) throw new NotFoundException("User not found");

  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpires = Date.now() + 60 * 60 * 1000; // 1 hour

  user.resetPasswordToken = await bcrypt.hash(token, 10);
  user.resetPasswordExpires = tokenExpires;
  await user.save();

  const resetLink = `${configService.getOrThrow("FRONTEND_URL")}/reset-password?token=${token}&email=${user.email}`;

  const info = await transport.sendMail({
    from: configService.getOrThrow("EMAIL"),
    to: user.email,
    subject: "Password Reset Request",
    text: `Reset your password using this link: ${resetLink}`,
  });

  if (!info.accepted.includes(user.email)) {
    throw new BadRequestError("Failed to send reset email");
  }

  return { message: "Password reset link sent to your email" };
};

export const resetPassword = async (token, newPassword, email) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) throw new NotFoundException("User not found");

  if (user.resetPasswordExpires < Date.now()) {
    throw new BadRequestError("Reset token expired");
  }

  const isValid = await bcrypt.compare(token, user.resetPasswordToken);
  if (!isValid) throw new BadRequestError("Invalid reset token");

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return true;
};
