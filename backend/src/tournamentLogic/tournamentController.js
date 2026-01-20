import * as tournamentService from "./tournamentService.js";
import * as fixtureService from "./fixtureService.js";
import { ValidatorClass } from "../lib/classes/validatorClass.js";
import { 
  createTournamentSchema, 
  updateTournamentSchema 
} from "./tournamentRequestSchema.js";
import { 
  ValidationException,
  NotFoundException
} from "../lib/classes/errorClasses.js";
import { asyncWrapper } from "../lib/utils.js";

const validator = new ValidatorClass();

// ================================
// TOURNAMENT CREATION
// ================================
export const createTournament = asyncWrapper(async (req, res) => {
  const { errors, value } = validator.validate(createTournamentSchema, req.body);
  if (errors) throw new ValidationException(errors);

  const userId = req.user._id;
  const { groupId } = req.params;

  const tournament = await tournamentService.createTournament({
    ...value,
    userId,
    groupId,
  });

  res.status(201).json({
    success: true,
    message: "Tournament created successfully",
    tournament,
  });
});

// ================================
// GET TOURNAMENT DETAILS
// ================================
export const getTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const tournament = await tournamentService.getTournamentById(tournamentId);

  // Optionally include fixture summary
  const fixturesSummary = await fixtureService.getTournamentFixtures(tournamentId);

  res.status(200).json({
    success: true,
    tournament: {
      ...tournament.toObject(),
      fixtureSummary: fixturesSummary.fixturesCount
        ? fixturesSummary
        : null,
    },
  });
});

// ================================
// GET ALL TOURNAMENTS FOR A GROUP
// ================================
export const getGroupTournaments = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const { status } = req.query;

  const tournaments = await tournamentService.getGroupTournaments(groupId, status);

  res.status(200).json({
    success: true,
    tournaments,
  });
});

// ================================
// UPDATE TOURNAMENT
// ================================
export const updateTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const { errors, value } = validator.validate(updateTournamentSchema, req.body);
  if (errors) throw new ValidationException(errors);

  const updatedTournament = await tournamentService.updateTournament({
    tournamentId,
    userId,
    updateData: value,
  });

  res.status(200).json({
    success: true,
    message: "Tournament updated successfully",
    tournament: updatedTournament,
  });
});

// ================================
// CANCEL/DELETE TOURNAMENT
// ================================
export const cancelTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  await tournamentService.cancelTournament({ tournamentId, userId });

  res.status(200).json({
    success: true,
    message: "Tournament cancelled successfully",
  });
});

// ================================
// TOURNAMENT READINESS CHECK
// ================================
export const checkTournamentReadiness = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  const readiness = await tournamentService.checkTournamentReadiness(tournamentId);

  res.status(200).json({
    success: true,
    readiness,
  });
});

// ================================
// START TOURNAMENT
// ================================
export const startTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const result = await fixtureService.startTournament({ tournamentId, userId });

  res.status(200).json({
    success: true,
    message: result.message,
    status: result.status,
  });
});

// ================================
// GET TOURNAMENT TABLE (LEAGUE STATS)
// ================================
export const getTournamentTable = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  const tournamentData = await tournamentService.getTournamentWithTable(tournamentId);

  res.status(200).json({
    success: true,
    tournament: tournamentData.tournament,
    table: tournamentData.currentTable,
    tableStats: tournamentData.tableStats,
  });
});
