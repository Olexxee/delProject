import * as matchDb from "../models/matchSchemaService.js";
import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as userStatsService from "../user/statschemaService.js";
import {
  NotFoundException,
  BadRequestError,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";
import { emitTournamentUpdate } from "../socket/chatSocket.js";

/**
 * Create a match record (admin only).
 * If you want to create a match tied to an existing fixture, pass fixtureId and matchday/home/away.
 */
export const createMatch = async ({ tournamentId, userId, matchData }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  // Only group admin can create/directly schedule matches
  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  // Basic validation: ensure both participants are in tournament
  const participantIds = tournament.participants.map((p) =>
    p.userId._id ? p.userId._id.toString() : p.userId.toString()
  );

  const { homeTeam, awayTeam } = matchData;
  if (!participantIds.includes(homeTeam.toString()) || !participantIds.includes(awayTeam.toString())) {
    throw new BadRequestError("Both teams must be registered in tournament");
  }

  const created = await matchDb.createMatch({
    tournamentId,
    ...matchData,
  });

  // Emit live: new match created
  emitTournamentUpdate(tournamentId, {
    type: "match_created",
    match: created,
  });

  return created;
};

/**
 * Submit or update match result (admin only). This will:
 * - Update Match doc (scores, participants' isWinner/score/goals)
 * - Mark match as closed/complete (isClosed)
 * - (matchSchema post-save hook will sync fixture and call updateParticipantStats)
 * - Emit tournament update
 */
export const submitMatchResult = async ({ matchId, userId, resultPayload }) => {
  const match = await matchDb.findMatchById(matchId);
  if (!match) throw new NotFoundException("Match not found");

  const tournament = await tournamentDb.findTournamentById(match.tournamentId._id || match.tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  // Admin check
  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  // Prevent editing result if tournament is completed or cancelled
  if (tournament.status === "completed" || tournament.status === "cancelled") {
    throw new BadRequestError("Cannot submit results for finished/cancelled tournament");
  }

  // Build participants array update (normalize incoming format)
  // resultPayload expected shape:
  // { participants: [{ userId, score, goals, kills, isWinner }], homeGoals, awayGoals, isClosed=true }
  const update = {
    participants: resultPayload.participants || match.participants,
    homeGoals: typeof resultPayload.homeGoals !== "undefined" ? resultPayload.homeGoals : match.homeGoals,
    awayGoals: typeof resultPayload.awayGoals !== "undefined" ? resultPayload.awayGoals : match.awayGoals,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    matchday: match.matchday,
  };

  if (resultPayload.isClosed) {
    update.isClosed = true;
    update.closedAt = new Date();
  }

  // Update the match doc
  const updatedMatch = await matchDb.updateMatch(matchId, update);

  // Immediately update the fixture too (so frontends reading fixtures see it instantly).
  try {
    const fixture = await fixtureDb.getTournamentFixtures(match.tournamentId)
      .then(fixtures => fixtures.find(f => 
        (f.homeTeam._id.toString() === (match.homeTeam._id || match.homeTeam).toString() &&
         f.awayTeam._id.toString() === (match.awayTeam._id || match.awayTeam).toString()) ||
        (f.homeTeam._id.toString() === (match.awayTeam._id || match.awayTeam).toString() &&
         f.awayTeam._id.toString() === (match.homeTeam._id || match.homeTeam).toString())
      ));

    if (fixture) {
      await fixtureDb.updateFixtureResult(fixture._id, {
        homeGoals: updatedMatch.homeGoals,
        awayGoals: updatedMatch.awayGoals,
        homeScore: updatedMatch.homeGoals,
        awayScore: updatedMatch.awayGoals,
      });
    }
  } catch (err) {
    // Log but don't fail the whole result submission
    console.error("Error syncing fixture after match update:", err);
  }

  // If match closed, call participant stats update (if you don't rely on match post-save hook)
  if (update.isClosed) {
    try {
      // Convert participants into the structure your participant stats expects
      // Example: [{ userId, score, isWinner, kills }]
      const statsParticipants = (updatedMatch.participants || []).map((p) => ({
        userId: p.userId._id ? p.userId._id : p.userId,
        score: p.score || 0,
        isWinner: !!p.isWinner,
        kills: p.kills || 0,
      }));

      await userStatsService.updateParticipantStats({
        matchId: updatedMatch._id,
        tournamentId: updatedMatch.tournamentId._id || updatedMatch.tournamentId,
        participants: statsParticipants,
      });
    } catch (err) {
      // If you already have the post-save hook doing this, this might be redundant.
      console.error("Error updating participant stats after match close:", err);
    }
  }

  // Emit live update: match_result
  emitTournamentUpdate(tournament._id || tournament, {
    type: "match_result",
    match: updatedMatch,
  });

  // Emit standings update request (client can call /table or we can compute here)
  emitTournamentUpdate(tournament._id || tournament, {
    type: "standings_refresh",
    tournamentId: tournament._id || tournament,
  });

  return updatedMatch;
};

/**
 * Get matches for a tournament
 */
export const getTournamentMatches = async (tournamentId) => {
  // validate tournament existence
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  return await matchDb.findMatchesByTournament(tournamentId);
};
