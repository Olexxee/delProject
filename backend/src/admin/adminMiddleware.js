import { ForbiddenError } from "../lib/classes/errorClasses.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import { asyncWrapper } from "../lib/utils.js";

// For platform-level superadmin only
export const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "superadmin") {
    throw new ForbiddenError("Only superadmin allowed");
  }
  next();
};

// For platform-level group admins or superadmin
export const requirePlatformGroupAdmin = (req, res, next) => {
  const allowed = ["groupAdmin", "superadmin"];
  if (!allowed.includes(req.user?.role)) {
    throw new ForbiddenError("Only group admins or superadmin allowed");
  }
  next();
};

export const requireGroupAdmin = asyncWrapper(async (req, res, next) => {
  let groupId = req.params.groupId;

  if (!groupId && req.params.tournamentId) {
    const tournament = await tournamentDb.findTournamentById(req.params.tournamentId);
    if (!tournament) throw new NotFoundError("Tournament not found");
    groupId = tournament.groupId;
  }

  if (!groupId) throw new BadRequestError("Missing groupId");

  const membership = await membershipService.findMembership({ userId: req.user.id, groupId });
  if (!membership || membership.role !== "admin") {
    throw new ForbiddenError("You are not a group admin");
  }

  next();
});
