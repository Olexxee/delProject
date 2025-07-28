import * as userService from "../user/userService.js";
import configService from "../lib/classes/configClass.js";
import {
  ConflictException,
  ValidationException,
  NotFoundException,
  ForbiddenError,
  BadRequestError,
  UnauthorizedException,
} from "../lib/classes/errorClasses.js";
import bcrypt from "bcrypt";
import transport from "../lib/classes/nodeMailerClass.js";
import jwtService from "../lib/classes/jwtClass.js";

export const authenticateUser = async (payload) => {
  let user;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(payload.email)) {
    user = await userService.findUserByEmail({ email: payload.email });
  }

  if (!user)
    throw new NotFoundException(
      "Invalid credentials, please check your credentials and try again"
    );

  const isValidPassword = await bcrypt.compare(payload.password, user.password);

  if (!isValidPassword)
    throw new UnauthorizedException(
      "Invalid credentials, please check your credentials and try again"
    );

  return jwtService.generateAuthenticationToken({
    id: user._id,
    email: user.email,
    role: user.role
  });
};

export const registerUser = async (payload) => {
  const user = await userService.findUserByEmail({ email: payload.email });

  if (user) {
    throw new ConflictException("User already exists");
  }

  const newUser = await userService.createUser(payload);
  console.log(newUser);

  return jwtService.generateAuthenticationToken({
    id: newUser._id,
    email: newUser.email,
  });
};

export const loginUser = async (payload) => {
  const user = await userService.findUserByEmail({ email: payload.email });

  if (!user) {
    throw new NotFoundException("User not found");
  }

  const isValidPassword = await bcrypt.compare(payload.password, user.password);

  if (!isValidPassword) {
    throw new UnauthorizedException("Invalid credentials");
  }

  console.log(`${user.email} has logged in sucessfully`);

  return jwtService.generateAuthenticationToken({
    id: user._id,
    email: user.email,
  });
};

export const getUserProfile = async (email) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) {
    throw new NotFoundException("User not found");
  }

  return {
    id: user._id,
    email: user.email,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const updateUserProfile = async (payload) => {
  const { email, ...updateData } = payload;
  const user = await userService.findUserByEmail({ email });

  if (!user) {
    throw new NotFoundException("User do not exist");
  }

  if (!user.isVerified) {
    throw new ForbiddenError("Only verified users can Update profile");
  }

  const updatedUser = await userService.updateUserByEmail(email, updateData);

  return {
    message: "Profile Updated Successfully",
    user: updatedUser,
  };
};

export const sendVerificationEmail = async (email) => {
  const user = await userService.findUserByEmail({ email });
  const codeExpiresIn = configService.getOrThrow("JWT_EXPIRE_IN");

  if (!user) {
    throw new NotFoundException("User not found");
  }

  if (user.isVerified) {
    throw new BadRequestException("User already verified");
  }

  // Generate the verification code

  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  const info = await transport.sendMail({
    from: configService.getOrThrow("EMAIL"),
    to: user.email,
    subject: "Verification Code",
    text: `Your verification code is ${verificationCode}`,
  });

  if (!info.accepted.includes(user.email)) {
    throw new BadRequestError("Failed to send verification email");
  }

  // To hash the verification code
  const hashedVerificationCode = await bcrypt.hash(verificationCode, 10);

  // Set expiration for the code
  const expiresInMinutes = 10; // or get it from config
  user.verificationCode = hashedVerificationCode;
  user.verificationCodeExpiresAt = Date.now() + expiresInMinutes * 60 * 1000;

  await user.save(); // Save updated user data

  return {
    message: "Verification email sent",
    expiresIn: expiresInMinutes,
  };
};

export const verifyUser = async (email, code) => {
  const user = await userService.findUserWithVerificationFields({ email });

  if (!user) {
    throw new NotFoundException("User not found");
  }

  if (user.isVerified) {
    throw new BadRequestError("User already verified");
  }

  if (!code || !user.verificationCode || !user.verificationCodeExpiresAt) {
    throw new BadRequestError("Verification code is missing or invalid");
  }

  // Check expiration first (cheaper than bcrypt)
  if (user.verificationCodeExpiresAt < Date.now()) {
    throw new BadRequestError("Verification code expired");
  }

  const isValidCode = await bcrypt.compare(code, user.verificationCode);
  if (!isValidCode) {
    throw new BadRequestError("Invalid verification code");
  }

  user.verified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiresAt = undefined;
  await user.save();

  return {
    success: true,
    message: "User verified successfully",
  };
};

export const changePassword = async (email, oldPassword, newPassword) => {
  const user = await userService.findUserByEmail({ email });

  if (!user) {
    throw new NotFoundException("User not found");
  }

  if (oldPassword === newPassword) {
    throw new BadRequestError(
      "New password cannot be the same as the old password"
    );
  }

  if (user.isVerified) {
    throw new BadRequestError("User is not verified");
  }

  const isValidPassword = await bcrypt.compare(oldPassword, user.password);

  if (!isValidPassword) {
    throw new UnauthorizedException("Invalid old password");
  }

  user.password = newPassword;
  await user.save();

  return {
    status: "success",
    message: "Password changed successfully",
  };
};

export const forgotPassword = async (email) => {
  const user = await userService.findUserByEmail({ email });

  if (!user) {
    throw new NotFoundException("User not found");
  }

  if (user.isVerified) {
    throw new BadRequestError("User is not verified");
  }

  const codeExpiresIn = configService.getOrThrow("JWT_EXPIRE_IN");

  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  const info = await transport.sendMail({
    from: configService.getOrThrow("EMAIL"),
    to: user.email,
    subject: "Forgot Password",
    text: `Your verification code is ${verificationCode}`,
  });

  if (!info.accepted.includes(user.email)) {
    throw new BadRequestError("Failed to send verification email");
  }

  const hashedVerificationCode = await bcrypt.hash(verificationCode, 10);
  user.verificationCode = hashedVerificationCode;
  user.verificationCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  return {
    message: "Verification email sent",
    expiresIn: codeExpiresIn,
  };
};

export const resetPassword = async (email, code, newPassword) => {
  const user = await userService.findUserWithVerificationFields({ email });

  if (!user) {
    throw new NotFoundException("User not found");
  }

  if (user.isVerified) {
    throw new BadRequestError("User is not verified");
  }

  if (!code || !user.verificationCode || !user.verificationCodeExpiresAt) {
    throw new BadRequestError("Verification code is missing or invalid");
  }

  if (user.verificationCodeExpiresAt < Date.now()) {
    throw new BadRequestError("Verification code expired");
  }

  const isValidCode = await bcrypt.compare(code, user.verificationCode);
  if (!isValidCode) {
    throw new BadRequestError("Invalid verification code");
  }

  user.password = newPassword;
  await user.save();

  return {
    status: "success",
    message: "Password reset successfully",
  };
};

const logoutUser = async (token) => {
  if (!token) {
    throw new UnauthorizedException("No token provided");
  }

  // Invalidate the token (implementation depends on your token storage)
  // This could be done by adding the token to a blacklist or removing it from a database

  return {
    status: "success",
    message: "User logged out successfully",
  };
};
