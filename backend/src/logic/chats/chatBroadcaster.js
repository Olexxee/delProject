import { ChatEvents } from "./chatContract.js";

class ChatBroadcaster {
  constructor(io) {
    this.io = io;
  }

  emitToRoom(chatRoomId, event, payload) {
    this.io.to(chatRoomId).emit(event, payload);
  }

  broadcastMessage(chatRoomId, message) {
    this.emitToRoom(chatRoomId, ChatEvents.NEW_MESSAGE, message);
  }

  notifyDelivered(chatRoomId, userId) {
    this.emitToRoom(chatRoomId, ChatEvents.DELIVERED, { chatRoomId, userId });
  }

  notifyRead(chatRoomId, userId) {
    this.emitToRoom(chatRoomId, ChatEvents.READ, { chatRoomId, userId });
  }

  notifyDeletedForAll(chatRoomId, messageId) {
    this.emitToRoom(chatRoomId, ChatEvents.DELETE_HARD, { messageId });
  }

  notifyTyping(chatRoomId, userId, isTyping) {
    this.emitToRoom(chatRoomId, ChatEvents.USER_TYPING, {
      chatRoomId,
      userId,
      isTyping,
    });
  }
}

export default ChatBroadcaster;
