import { Router } from "express";
import { updateUserProfileController } from "../auth/authController.js";
import upload from "../lib/multerConfig.js";
import authMiddleware from "../middlewares/authenticationMdw.js";
import verifiedOnly from "../middlewares/verifiedOnly.js";

const router = Router();

router.put(
  "/updateprofile",
  authMiddleware,
  verifiedOnly,
  upload.single("profilePicture"),
  updateUserProfileController
);

const userRoute = router;

export default userRoute;
