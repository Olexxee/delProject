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

export const toggleMuteSchema = Joi.object({
  mute: Joi.boolean().required(),
});

export const changeRoleSchema = Joi.object({
  memberId: Joi.string()
    .required()
    .regex(/^[a-fA-F0-9]{24}$/)
    .message("Invalid member ID format"),
  newRole: Joi.string()
    .valid("admin", "moderator", "member")
    .required()
    .messages({
      "any.only": "Role must be one of admin, moderator, or member",
      "string.empty": "Role cannot be empty",
    }),
});
