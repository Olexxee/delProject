import logger from "../lib/logger.js";
import jwtService from "../lib/classes/jwtClass.js";
import { UnauthorizedException } from "../lib/classes/errorClasses.js";
import * as profileDb from "../models/profileSchemaService.js";

/**
 * Helper: extract token from Authorization header or cookies
 */
const extractToken = (req) => {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return req.headers.authorization.split(" ")[1];
  }
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  return null;
};

/**
 * Middleware: requires valid authentication
 */
export const authMiddleware = (req, res, next) => {
  try {
    logger.info("🔐 === AUTH MIDDLEWARE DEBUG ===");
    logger.info("📍 Request URL:", req.originalUrl);

    // Safely extract token
    const cookieToken = req?.cookies?.token;
    const authHeader = req?.headers?.authorization;
    const headerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    const token = cookieToken || headerToken;

    logger.info("🎫 Cookie token:", cookieToken || "none");
    logger.info("🎫 Header token:", authHeader || "none");
    logger.info(
      "🎫 Token being used:",
      token ? token.slice(0, 20) + "..." : "none"
    );

    if (!token) {
      throw new UnauthorizedException("No authentication token provided");
    }

    // Verify token
    const decoded = jwtService.verifyAuthenticationToken(token);
    logger.info("✅ Token decoded:", decoded);

    // Attach user
    req.user = {
      _id: decoded.id,
      id: decoded.id,
      email: decoded.email,
      profileId: decoded.profileId,
    };

    logger.info("🔐 === END AUTH MIDDLEWARE ===");
    return next();
  } catch (err) {
    logger.error("❌ Authentication failed:", err.message);
    /* TODO: Check level */ logger.error("🔐 === END AUTH MIDDLEWARE ===");
    return next(new UnauthorizedException(err.message || "Unauthorized"));
  }
};

/**
 * Middleware: optional authentication (doesn't block if missing/invalid)
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      try {
        const decoded = jwtService.verifyAuthenticationToken(token);
        req.user = {
          id: decoded.id,
          email: decoded.email,
          profileId: decoded.profileId || null,
          iat: decoded.iat,
          exp: decoded.exp,
        };
        logger.info(
          "✅ Optional auth successful for:",
          req.user.email || req.user.id
        );
      } catch (err) {
        /* TODO: Check level */ logger.error(
          "⚠️ Optional auth failed, continuing without auth:",
          err.message
        );
      }
    }

    next();
  } catch (err) {
    /* TODO: Check level */ logger.error(
      "⚠️ Optional auth middleware error, continuing:",
      err.message
    );
    next();
  }
};

/**
 * Middleware: requires user to be authenticated and verified
 */
export const requireVerifiedUser = (req, res, next) => {
  if (!req.user) {
    throw new UnauthorizedException("Authentication required");
  }

  // Example: add verification check here if needed
  // const user = await userRepository.findUserById(req.user.id);
  // if (!user.verified) throw new UnauthorizedException("Email verification required");

  next();
};
