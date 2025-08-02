import Joi from "joi";
import moment from "moment";

export const createTournamentSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).allow("").optional(),
  maxParticipants: Joi.number().min(4).max(50).optional().default(20),
  startDate: Joi.date().min("now").optional(),
  endDate: Joi.date().greater(Joi.ref("startDate")).optional(),
  registrationDeadline: Joi.date()
    .min("now")
    .max(Joi.ref("startDate"))
    .required(),
  settings: Joi.object({
    pointsForWin: Joi.number().min(0).max(10).optional().default(3),
    pointsForDraw: Joi.number().min(0).max(10).optional().default(1),
    pointsForLoss: Joi.number().min(0).max(10).optional().default(0),
    rounds: Joi.string().valid("single", "double").optional().default("single"),
  }).optional(),
});

export const updateTournamentSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).allow("").optional(),
  maxParticipants: Joi.number().min(4).max(50).optional(),
  registrationDeadline: Joi.date().min("now").optional(),
  settings: Joi.object({
    pointsForWin: Joi.number().min(0).max(10).optional(),
    pointsForDraw: Joi.number().min(0).max(10).optional(),
    pointsForLoss: Joi.number().min(0).max(10).optional(),
    rounds: Joi.string().valid("single", "double").optional(),
  }).optional(),
});
