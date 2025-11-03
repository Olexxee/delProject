import Joi from "joi";

const matchResultSchema = Joi.object({
  participants: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string().required(),
        score: Joi.number().default(0),
        goals: Joi.number().default(0),
        kills: Joi.number().default(0),
        isWinner: Joi.boolean().optional(),
      })
    )
    .min(2)
    .required(),
  homeGoals: Joi.number().required(),
  awayGoals: Joi.number().required(),
  isClosed: Joi.boolean().default(true),
}).required();