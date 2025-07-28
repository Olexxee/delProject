import * as authService from "./authService.js";
import {
  ValidationException,
  BadRequestError,
  NotFoundException,
} from "../lib/classes/errorClasses.js";
import { ValidatorClass } from "../lib/classes/validatorClass.js";
import {
  registerSchema,
  loginSchema,
  updateUserProfile,
  verificationSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./authRequest.js";
import { asyncWrapper } from "../lib/utils.js";
import path from "path"
import fs from "fs"

// signup controller

const validator = new ValidatorClass();

export const signUp = asyncWrapper(async (req, res) => {
  const { errors, value } = validator.validate(registerSchema, req.body);
  if (errors) {
    throw new ValidationException(errors);
  }

  const user = await authService.registerUser(value);
  res.status(201).json(user);
});

export const login = asyncWrapper(async (req, res) => {
  const { errors, value } = validator.validate(loginSchema, req.body);
  if (errors) {
    throw new ValidationException(errors);
  }

  const token = await authService.authenticateUser(value);
  res.cookie("token", token);

  return res.status(200).json({
    success: true,
    message: "User login successful",
  });
});

export const getUser = asyncWrapper(async (req, res) => {
  const user = await authService.getUserProfile(req.user.email);

  res.status(200).json({
    success: true,
    user,
  });
});

export const updateUserProfileController = asyncWrapper(async (req, res) => {
  const { error, value } = updateUserProfile.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      details: error.details.map((e) => e.message),
    });
  }

  const email = req.user.email;
  const profilePicture = req.file
    ? `/uploads/profile_pictures/${req.file.filename}`
    : undefined;

  const payload = {
    ...value,
    email,
    ...(profilePicture && { profilePicture }),
  };

  try {
    const updatedProfile = await authService.updateUserProfile(payload);

    return res.status(200).json({
      message: "User profile updated successfully",
      success: true,
      user: updatedProfile.user,
    });
  } catch (err) {
    // 🧹 Cleanup uploaded file if user is unverified or update fails
    if (req.file) {
      const filePath = path.join(
        "uploads",
        "profile_pictures",
        req.file.filename
      );
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr)
          console.error("Failed to delete file:", unlinkErr.message);
      });
    }

    // rethrow or respond with the error
    throw err; 
  }
});


export const sendVerificationEmail = asyncWrapper(async (req, res) => {
  const { email } = req.body;

  try {
    const CodeSent = await authService.sendVerificationEmail(email);

    return res.status(200).json({
      success: true,
      message: "Verification email sent",
      verificationCode: CodeSent.verificationCode,
    });
  } catch (error) {
    throw new BadRequestError(error.message);
  }
});

export const verifyEmail = asyncWrapper(async (req, res) => {
  const { error } = verificationSchema.validate(req.body);
  if (error) {
    throw new BadRequestError(error.details[0].message);
  }

  const { email, verificationCode } = req.body;
  const verified = await authService.verifyUser(email, verificationCode);

  return res.status(200).json(verified);
});

export const changePassword = asyncWrapper(async (req, res) => {
  const { errors, value } = validator.validate(changePasswordSchema, req.body);
  if (errors) {
    throw new ValidationException(errors);
  }

  const { email, oldPassword, newPassword } = value;
  const updatedUser = await authService.changePassword(
    email,
    oldPassword,
    newPassword
  );

  return res.status(200).json(updatedUser);
});

export const forgotPassword = asyncWrapper(async (req, res) => {
  const { errors, value } = validator.validate(forgotPasswordSchema, req.body);
  if (errors) {
    throw new ValidationException(errors);
  }

  const { email } = value;
  const codeSent = await authService.forgotPassword(email);

  return res.status(200).json(codeSent);
});

export const resetPassword = asyncWrapper(async (req, res) => {
  const { errors, value } = validator.validate(resetPasswordSchema, req.body);
  if (errors) {
    throw new ValidationException(errors);
  }

  const { email, code, newPassword } = value;
  const resetPassword = await authService.resetPassword(
    email,
    code,
    newPassword
  );

  return res.status(200).json(resetPassword);
});

export const logout = asyncWrapper(async (req, res) => {
  res.clearCookie("token");
  return res.status(200).json({
    success: true,
    message: "User logged out successfully",
  });
});
