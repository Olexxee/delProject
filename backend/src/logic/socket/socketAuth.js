import * as userService from "../../user/userService.js";
import {
  UnauthorizedException,
  NotFoundException,
} from "../../lib/classes/errorClasses.js";
import JwtService from "../../lib/classes/jwtClass.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new UnauthorizedException("Missing auth token");

    let decoded;
    try {
      decoded = JwtService.verifyAuthenticationToken(token);
    } catch (err) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    const user = await userService.findUserById(decoded.id);
    if (!user) throw new NotFoundException("User not found");

    socket.user = {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
    };

    next();
  } catch (err) {
    next(err);
  }
};
