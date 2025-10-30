import { asyncWrapper } from "../middlewares/asyncWrapper.js";
import * as chatService from "./chatService.js"

//  Create or get peer chat
export const createPeerChat = asyncWrapper(async (req, res) => {
  const { userId } = req.body;
  const chat = await chatService.handlePeerChat(req.user.id, userId);
  res.status(200).json({ success: true, chat });
});

// Create group chat
export const createGroupChat = asyncWrapper(async (req, res) => {
  const { name, participants, groupId } = req.body;
  const chat = await chatService.handleGroupChat(name, participants, groupId);
  res.status(201).json({ success: true, chat });
});

//  Get all user chats
export const getUserChats = asyncWrapper(async (req, res) => {
  const chats = await chatService.fetchUserChats(req.user.id);
  res.status(200).json({ success: true, chats });
});
