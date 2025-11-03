import * as matchService from "../services/matchService.js";
import * as fixtureService from "../services/fixtureService.js";
import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as userStatsService from "../user/statschemaService.js";
import {
  BadRequestError,
  NotFoundException,
} from "../lib/classes/errorClasses.js";
import { notifyAndEmit } from "../lib/notifiers/tournamentNotifier.js";



/**
 * Submit match result (admin only)
 */
export const submitMatchResult = async ({ matchId, userId, resultPayload }) => {
  // ✅ Validate input
  const { value, error } = matchResultSchema.validate(resultPayload);
  if (error) throw new BadRequestError(error.details[0].message);

  // ✅ Get match + tournament
  const match = await matchService.findMatchById(matchId);
  if (!match) throw new NotFoundException("Match not found");

  const tournament = await tournamentDb.findTournamentById(
    match.tournamentId._id || match.tournamentId
  );
  if (!tournament) throw new NotFoundException("Tournament not found");

  // ✅ Admin check
  await membershipService.assertIsAdmin({
    userId,
    groupId: tournament.groupId._id || tournament.groupId,
  });

  const { homeGoals, awayGoals } = value;

  // ✅ Map participants & auto-determine winners
  const participants = (value.participants || []).map((p) => {
    const userIdStr = p.userId.toString();
    const homeTeamId = match.homeTeam._id
      ? match.homeTeam._id.toString()
      : match.homeTeam.toString();
    const awayTeamId = match.awayTeam._id
      ? match.awayTeam._id.toString()
      : match.awayTeam.toString();

    let isWinner = p.isWinner;
    if (typeof isWinner === "undefined") {
      if (homeGoals > awayGoals && userIdStr === homeTeamId) isWinner = true;
      else if (awayGoals > homeGoals && userIdStr === awayTeamId)
        isWinner = true;
      else isWinner = false;
    }

    return {
      userId: p.userId,
      score: p.score || 0,
      goals:
        typeof p.goals !== "undefined"
          ? p.goals
          : userIdStr === homeTeamId
          ? homeGoals
          : userIdStr === awayTeamId
          ? awayGoals
          : 0,
      kills: p.kills || 0,
      isWinner,
    };
  });

  // ✅ Build match update object
  const update = {
    participants,
    homeGoals,
    awayGoals,
    isClosed: value.isClosed,
    closedAt: value.isClosed ? new Date() : null,
  };

  // ✅ Update match record
  const updatedMatch = await matchService.updateMatch(matchId, update);

  // ✅ Sync with fixture
  try {
    const fixture = await fixtureDb.findByTeamsAndTournament(
      match.homeTeam._id || match.homeTeam,
      match.awayTeam._id || match.awayTeam,
      updatedMatch.tournamentId._id || updatedMatch.tournamentId
    );

    if (fixture) {
      await fixtureDb.updateFixtureResult(fixture._id, {
        homeGoals: updatedMatch.homeGoals,
        awayGoals: updatedMatch.awayGoals,
        homeScore: updatedMatch.homeGoals,
        awayScore: updatedMatch.awayGoals,
      });

      // ✅ Trigger fixture progression (cup / league / hybrid)
      if (update.isClosed) {
        await fixtureService.handleFixtureCompletion(
          match.fixtureId || fixture._id
        );
      }
    }
  } catch (err) {
    console.error("Fixture sync/progression error:", err);
  }

  // ✅ Update user stats
  if (update.isClosed) {
    const statsParticipants = participants.map((p) => ({
      userId: p.userId,
      score: p.score,
      isWinner: p.isWinner,
      kills: p.kills,
      goals: p.goals,
    }));

    try {
      await userStatsService.updateParticipantStats({
        matchId: updatedMatch._id,
        tournamentId:
          updatedMatch.tournamentId._id || updatedMatch.tournamentId,
        participants: statsParticipants,
      });
    } catch (err) {
      console.error("Error updating participant stats:", err);
    }
  }

  // ✅ Notify and emit events
  await notifyAndEmit({
    tournamentId: tournament._id,
    recipients: tournament.participants.map((p) => p.userId._id || p.userId),
    notificationPayload: {
      recipient: tournament.participants.map((p) => p.userId._id || p.userId),
      sender: userId,
      type: "match_result",
      title: "Match Result Updated",
      message: `Results have been posted for a match in ${tournament.name}.`,
      meta: { matchId: updatedMatch._id },
    },
    socketEvent: { type: "match_result", match: updatedMatch },
  });

  // ✅ Request standings refresh
  await notifyAndEmit({
    tournamentId: tournament._id,
    socketEvent: { type: "standings_refresh", tournamentId: tournament._id },
  });

  return updatedMatch;
};
