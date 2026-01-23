const userSockets = new Map();

/**
 * Register a socket for a user
 */
export const registerSocket = (userId, socketId) => {
  const sockets = userSockets.get(userId) || new Set();
  sockets.add(socketId);
  userSockets.set(userId, sockets);
};

/**
 * Unregister a socket for a user
 */
export const unregisterSocket = (userId, socketId) => {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) userSockets.delete(userId);
  else userSockets.set(userId, sockets);
};

/**
 * Get all active socket IDs for a user
 */
export const getSocketsByUserId = (userId) => {
  return userSockets.get(userId) ? Array.from(userSockets.get(userId)) : [];
};
