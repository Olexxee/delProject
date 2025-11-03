import * as matchLogic from "../logic/matchLogic.js";
import { asyncWrapper } from "../lib/utils.js";
import { matchResultSchema } from "./matchRequest.js";
import {
  BadRequestError,
  NotFoundException,
} from "../lib/classes/errorClasses.js";

export const createMatch = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;
  const matchData = req.body;
  const created = await matchLogic.createMatch({
    tournamentId,
    userId,
    matchData,
  });
  res.status(201).json({ success: true, data: created });
});

export const submitMatchResult = asyncWrapper(async (req, res) => {
  const { error, value } = matchResultSchema.validate(resultPayload);
  if (error) throw new BadRequestError(error.details[0].message);
  const { matchId } = req.params;
  const userId = req.user._id;
  const payload = req.body;
  const updated = await matchLogic.submitMatchResult({
    matchId,
    userId,
    resultPayload: payload,
  });
  res.json({ success: true, data: updated });
});

export const getTournamentMatches = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const matches = await matchLogic.getTournamentMatches(tournamentId);
  res.json({ success: true, data: matches });
});
