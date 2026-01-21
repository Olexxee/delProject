import logger from "../../lib/logger.js";
import ChatRoom from "../../models/chatRoomSchema.js";
import Message from "../../models/messageSchema.js";
import Connection from "../../models/connectionSchema.js";
import Profile from "../../models/profileSchema.js";
import User from "../../user/userSchema.js";
import {
  BadRequestError,
  NotFoundException,
  ForbiddenError,
} from "../../lib/classes/errorClasses.js";

/**
 * Get or create chat room for a connection
 * Only works if connection exists and is accepted
 */
export const getOrCreateConnectionChatRoom = async (userId, connectionId) => {
  // Get user's profile
  const userProfile = await Profile.findOne({ user: userId });
  if (!userProfile) {
    throw new NotFoundException("User profile not found");
  }

  // Get connection and verify it exists and is accepted
  const connection = await Connection.findById(connectionId);
  if (!connection) {
    throw new NotFoundException("Connection not found");
  }

  // Verify user is part of this connection
  const isSender = connection.senderProfile.toString() === userProfile._id.toString();
  const isRecipient = connection.recipientProfile.toString() === userProfile._id.toString();

  if (!isSender && !isRecipient) {
    throw new ForbiddenError("You are not part of this connection");
  }

  // Verify connection is accepted
  if (connection.status !== "accepted") {
    throw new BadRequestError("Connection must be accepted before chatting");
  }

  // Get the other user's profile
  const otherProfileId = isSender 
    ? connection.recipientProfile 
    : connection.senderProfile;
  
  const otherProfile = await Profile.findById(otherProfileId);
  if (!otherProfile) {
    throw new NotFoundException("Other user's profile not found");
  }

  // Check if chat room already exists for this connection
  let chatRoom = await ChatRoom.findOne({
    contextType: "Connection",
    contextId: connectionId,
  });

  if (!chatRoom) {
    // Create new chat room with both users as participants
    const participants = [userProfile.user, otherProfile.user];
    
    chatRoom = await ChatRoom.create({
      contextType: "Connection",
      contextId: connectionId,
      participants,
    });

    logger.info(`[ConnectionChat] Created chat room ${chatRoom._id} for connection ${connectionId}`);
  }

  // Populate participants with user details
  await chatRoom.populate("participants", "username email firstName lastName profilePicture");

  return chatRoom;
};

/**
 * Get all chat rooms for a user (their accepted connections)
 */
export const getUserConnectionChatRooms = async (userId) => {
  // Get user's profile
  const userProfile = await Profile.findOne({ user: userId });
  if (!userProfile) {
    throw new NotFoundException("User profile not found");
  }

  // Find all accepted connections where user is sender or recipient
  const connections = await Connection.find({
    $or: [
      { senderProfile: userProfile._id, status: "accepted" },
      { recipientProfile: userProfile._id, status: "accepted" },
    ],
  });

  const connectionIds = connections.map(c => c._id);

  // Find all chat rooms for these connections
  const chatRooms = await ChatRoom.find({
    contextType: "Connection",
    contextId: { $in: connectionIds },
    participants: userId,
  })
    .populate("participants", "username email firstName lastName profilePicture")
    .sort({ updatedAt: -1 })
    .lean();

  // Enrich with connection and last message info
  const enrichedRooms = await Promise.all(
    chatRooms.map(async (room) => {
      // Get connection details
      const connection = connections.find(
        c => c._id.toString() === room.contextId.toString()
      );

      // Get last message
      const lastMessage = await Message.findOne({ chatRoom: room._id })
        .sort({ createdAt: -1 })
        .populate("sender", "username firstName lastName profilePicture")
        .lean();

      // Get unread count
      const unreadCount = await Message.countDocuments({
        chatRoom: room._id,
        sender: { $ne: userId },
        readBy: { $ne: userId },
      });

      // Get other participant (not the current user)
      const otherParticipant = room.participants.find(
        p => p._id.toString() !== userId.toString()
      );

      return {
        ...room,
        connection: {
          _id: connection._id,
          status: connection.status,
          matchedAt: connection.matchedAt,
        },
        lastMessage: lastMessage || null,
        unreadCount,
        otherParticipant,
      };
    })
  );

  return enrichedRooms;
};

/**
 * Send a message in a connection chat room (text-only)
 */
export const sendConnectionMessage = async (userId, connectionId, content) => {
  if (!content || !content.trim()) {
    throw new BadRequestError("Message content is required");
  }

  // Get or create chat room (this also validates the connection)
  const chatRoom = await getOrCreateConnectionChatRoom(userId, connectionId);

  // Create message (text-only for connections)
  const message = await Message.create({
    chatRoom: chatRoom._id,
    sender: userId,
    content: content.trim(),
    media: [], // No media for connection chats
  });

  // Populate sender info
  await message.populate("sender", "username email firstName lastName profilePicture");

  // Emit real-time message via Socket.io
  if (global._io && global._userSocketMap) {
    const payload = {
      _id: message._id,
      chatRoom: chatRoom._id,
      connectionId: connectionId,
      sender: {
        _id: message.sender._id,
        username: message.sender.username,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        profilePicture: message.sender.profilePicture,
      },
      content: message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };

    // Emit to all participants in the chat room
    chatRoom.participants.forEach((participantId) => {
      const idStr = participantId.toString();
      if (idStr !== userId.toString()) {
        const socketId = global._userSocketMap.get(idStr);
        if (socketId) {
          // Emit to specific socket
          global._io.to(socketId).emit("newConnectionMessage", payload);
          // Also emit to room for consistency
          global._io.to(socketId).emit("newMessage", payload);
        }
      }
    });

    // Also emit to room (for Socket.io room-based subscriptions)
    global._io.to(chatRoom._id.toString()).emit("newConnectionMessage", payload);
  }

  logger.info(`[ConnectionChat] Message sent in room ${chatRoom._id} by user ${userId}`);

  return message;
};

/**
 * Get messages for a connection chat room
 */
export const getConnectionMessages = async (userId, connectionId, limit = 50, skip = 0) => {
  // Verify connection and get chat room
  const chatRoom = await getOrCreateConnectionChatRoom(userId, connectionId);

  // Get messages
  const messages = await Message.find({ chatRoom: chatRoom._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate("sender", "username email firstName lastName profilePicture")
    .lean();

  // Reverse to show oldest first
  return messages.reverse();
};

/**
 * Mark messages as read in a connection chat room
 */
export const markConnectionMessagesRead = async (userId, connectionId) => {
  // Verify connection and get chat room
  const chatRoom = await getOrCreateConnectionChatRoom(userId, connectionId);

  // Mark all unread messages as read
  const result = await Message.updateMany(
    {
      chatRoom: chatRoom._id,
      sender: { $ne: userId },
      readBy: { $ne: userId },
    },
    {
      $addToSet: { readBy: userId },
    }
  );

  logger.info(`[ConnectionChat] Marked ${result.modifiedCount} messages as read for user ${userId}`);

  return {
    success: true,
    readCount: result.modifiedCount,
  };
};

/**
 * Get unread message count for a connection chat
 */
export const getConnectionUnreadCount = async (userId, connectionId) => {
  // Verify connection and get chat room
  const chatRoom = await getOrCreateConnectionChatRoom(userId, connectionId);

  const count = await Message.countDocuments({
    chatRoom: chatRoom._id,
    sender: { $ne: userId },
    readBy: { $ne: userId },
  });

  return count;
};

