import jwt from "jsonwebtoken";
import * as userService from "../../user/userService.js";
import {
  UnauthorizedException,
  NotFoundException,
} from "../../lib/classes/errorClasses.js";
import configService from "../../lib/classes/configClass.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new UnauthorizedException("Missing auth token");

    let decoded;
    try {
      decoded = jwt.verify(token, configService.getOrThrow("JWT_SECRET"));
    } catch (err) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const user = await userService.findUserById(decoded.id);
    if (!user) throw new NotFoundException("User not found");

    socket.user = {
      id: user._id.toString(),
      email: user.email,
      username: user.username, // optional, if useful for events
    };

    next();
  } catch (err) {
    next(err);
  }
};

