import * as tournamentService from "./tournamentService.js";
import { ValidatorClass } from "../lib/classes/validatorClass.js";
import { createTournamentSchema, updateTournamentSchema } from "./tournamentRequestSchema.js";
import {
  ValidationException,
  NotFoundException,
} from "../lib/classes/errorClasses.js";
import { asyncWrapper } from "../lib/utils.js";

const validator = new ValidatorClass();

// Create tournament
export const createTournament = asyncWrapper(async (req, res) => {
  // Validate input
  const { errors, value } = validator.validate(createTournamentSchema, req.body);
  if (errors) throw new ValidationException(errors);

  const userId = req.user._id;
  const { groupId } = req.params;

  // Create tournament
  const tournament = await tournamentService.createTournament({
    ...value,
    userId,
    groupId,
  });

  res.status(201).json({
    success: true,
    message: "Tournament created successfully",
    tournamentId: tournament._id,
    tournament,
  });
});

// Get tournament by ID
export const getTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const tournament = await tournamentService.getTournamentById(tournamentId);

  res.status(200).json({
    success: true,
    tournament,
  });
});

// Get all tournaments for a group
export const getGroupTournaments = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const { status } = req.query;

  const tournaments = await tournamentService.getGroupTournaments(groupId, status);

  res.status(200).json({
    success: true,
    tournaments,
  });
});

// Update tournament
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

// Cancel tournament
export const cancelTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  await tournamentService.cancelTournament({ tournamentId, userId });

  res.status(200).json({
    success: true,
    message: "Tournament cancelled successfully",
  });
});