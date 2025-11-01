import * as matchService from "../services/matchService.js";
import { asyncWrapper } from "../lib/utils.js";
import {
  NotFoundException,
  BadRequestError,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";

// Create a match (admin)
export const createMatch = asyncWrapper(async (req, res) => {
  const userId = req.user._id; // adjust per your auth middleware
  const { tournamentId, matchData } = req.body;

  const created = await matchService.createMatch({
    tournamentId,
    userId,
    matchData,
  });
  res.status(201).json({ message: "Match created", match: created });
});

// Submit or update match result (admin)
export const submitResult = asyncWrapper(async (req, res) => {
  const userId = req.user._id;
  const matchId = req.params.id;
  const resultPayload = req.body; // see shape expected in service

  const updated = await matchService.submitMatchResult({
    matchId,
    userId,
    resultPayload,
  });
  res.status(200).json({ message: "Match result submitted", match: updated });
});

// Get tournament matches
export const getMatchesForTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const matches = await matchService.getTournamentMatches(tournamentId);
  res.status(200).json({ matches });
});

// Get single match
export const getMatchById = asyncWrapper(async (req, res) => {
  const matchId = req.params.id;
  const match =
    (await matchService.getMatchById?.(matchId)) ||
    (await import("../models/matchSchemaService.js")).then((m) =>
      m.findMatchById(matchId)
    );
  if (!match) throw new NotFoundException("Match not found");
  res.status(200).json({ match });
});
