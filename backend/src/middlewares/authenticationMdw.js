import jwtClass from "../lib/classes/jwtClass.js";
import { UnauthorizedException } from "../lib/classes/errorClasses.js";
import { findUserById } from "../user/userService.js"; // ✅ make sure this is correct path

export default async function authMiddleware(req, res, next) {
  try {
    let token;

    // 1. Check token in cookies
    if (req.cookies?.token) {
      token = req.cookies.token;
      console.log("Auth token found in cookie:", token);
    }

    // 2. Fallback to Bearer token in headers
    else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
      console.log("Auth token found in header:", token);
    }

    // 3. If token is missing
    if (!token) {
      throw new UnauthorizedException("Invalid or missing authentication");
    }

    // 4. Verify token using your jwtClass
    const decoded = jwtClass.verifyAuthenticationToken(token);

    // 5. Fetch real user from DB using ID in decoded payload
    const user = await findUserById(decoded.id);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // 6. Attach full DB user to request
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}
