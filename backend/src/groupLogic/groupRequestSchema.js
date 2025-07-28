import Joi from "joi";

export const createGroupSchema = Joi.object({
  groupName: Joi.string().min(3).max(50).required(),
  description: Joi.string().min(10).max(500).allow("").optional(),
  avatar: Joi.string().uri().allow("").optional(),
  privacy: Joi.string()
    .valid("public", "private", "protected")
    .optional()
    .default("public"),
});

export const updateGroupSchema = Joi.object({
  groupName: Joi.string().min(3).max(50).optional(),
  description: Joi.string().min(10).max(500).allow("").optional(),
  avatar: Joi.string().uri().allow("").optional(),
  privacy: Joi.string().valid("public", "private", "protected").optional(),
});
