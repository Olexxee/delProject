import * as userService from "../user/userService.js";
import { ConflictException, NotFoundException, ForbiddenError, BadRequestError, UnauthorizedException } from "../lib/classes/errorClasses.js";
import bcrypt from "bcrypt";
import jwtService from "../lib/classes/jwtClass.js";
import { serializeUser } from "../lib/serializeUser.js";
import crypto from "crypto";
import logger  from "../lib/logger.js"
import { sendNotification } from "../logic/notifications/notificationService.js";
import { NotificationTypes } from "../logic/notifications/notificationTypes.js";
import { getEmailTemplate } from "../logic/notifications/emailTemplates.js";
import configService from "../lib/classes/configClass.js";

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

  // Send welcome notification & email
  await sendNotification({
    recipient: newUser._id,
    sender: "system",
    type: NotificationTypes.USER_REGISTERED,
    title: "Welcome to Delyx 🎮",
    message: `Hi ${newUser.username}, welcome to Delyx! Your gaming community awaits.`,
    channels: ["inApp", "email"],
    meta: {
      email: newUser.email,
      payload: getEmailTemplate("WELCOME_EMAIL", { username: newUser.username, profileLink: `${configService.getOrThrow("FRONTEND_URL")}/profile` })
    }
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
  user.verificationCode = await bcrypt.hash(verificationCode, 10);
  user.verificationCodeExpiresAt = Date.now() + 10 * 60 * 1000;
  await user.save();

  // Send via notification service
  await sendNotification({
    recipient: user._id,
    sender: "system",
    type: NotificationTypes.VERIFICATION_SENT,
    title: "Verify your email 🔑",
    message: `Use code ${verificationCode} to verify your email.`,
    channels: ["email"],
    meta: {
      email: user.email,
      payload: getEmailTemplate("OTP_EMAIL", { username: user.username, code: verificationCode })
    }
  });

  return { expiresIn: 10 }; // minutes
};

export const verifyUser = async (email, code) => {
  const user = await userService.findUserWithVerificationFields({ email });
  if (!user) throw new NotFoundException("User not found");
  if (user.verificationCodeExpiresAt < Date.now()) throw new BadRequestError("Verification code expired");

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

  // Notify user
  await sendNotification({
    recipient: user._id,
    sender: "system",
    type: NotificationTypes.PASSWORD_CHANGED,
    title: "Password Changed 🔐",
    message: "Your password has been successfully updated.",
    channels: ["inApp", "email"],
    meta: {
      email: user.email,
      payload: getEmailTemplate("PASSWORD_CHANGED", { username: user.username })
    }
  });

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

  await sendNotification({
    recipient: user._id,
    sender: "system",
    type: NotificationTypes.PASSWORD_RESET_REQUESTED,
    title: "Password Reset Request 🔑",
    message: "You requested a password reset.",
    channels: ["email"],
    meta: {
      email: user.email,
      payload: getEmailTemplate("PASSWORD_RESET_REQUESTED", { username: user.username, resetLink })
    }
  });

  return { message: "Password reset link sent to your email" };
};

export const resetPassword = async (token, newPassword, email) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) throw new NotFoundException("User not found");

  if (user.resetPasswordExpires < Date.now()) throw new BadRequestError("Reset token expired");

  const isValid = await bcrypt.compare(token, user.resetPasswordToken);
  if (!isValid) throw new BadRequestError("Invalid reset token");

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  // Notify user
  await sendNotification({
    recipient: user._id,
    sender: "system",
    type: NotificationTypes.PASSWORD_RESET_SUCCESS,
    title: "Password Reset Successful 🎉",
    message: "You can now log in with your new password.",
    channels: ["inApp", "email"],
    meta: {
      email: user.email,
      payload: getEmailTemplate("PASSWORD_RESET_SUCCESS", { username: user.username })
    }
  });

  return true;
};


export const addDeviceToken = async (userId, deviceToken) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  user.deviceTokens = user.deviceTokens || [];

  if (!user.deviceTokens.includes(deviceToken)) {
    user.deviceTokens.push(deviceToken);
    await user.save();
  }

  return user;
};

export const removeDeviceToken = async (userId, deviceToken) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  user.deviceTokens = (user.deviceTokens || []).filter((t) => t !== deviceToken);
  await user.save();

  return user;
};