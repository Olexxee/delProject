import express from "express";
import * as buddyController from "../../groupLogic/buddyConnection/buddyConnectionController.js";
import { authMiddleware } from "../../middlewares/authenticationMdw.js";

const buddyRouter = express.Router();

buddyRouter.post("/connect", authMiddleware, buddyController.sendBuddyRequest);


buddyRouter.post(
  "/accept/:connectionId",
  authMiddleware,
  buddyController.acceptConnection
);

buddyRouter.post(
  "/block/:userId",
  authMiddleware,
  buddyController.blockBuddyUser
);

buddyRouter.post(
  "/unblock/:userId",
  authMiddleware,
  buddyController.unblockBuddyUser
);

buddyRouter.delete(
  "/remove/:userId",
  authMiddleware,
  buddyController.removeBuddyConnection
);

buddyRouter.get("/list-connect", authMiddleware, buddyController.listBuddyConnections);

buddyRouter.get(
  "/connections/:requesterId/:recipientId",
  authMiddleware,
  buddyController.getConnectionDetailsController
);

export default buddyRouter;