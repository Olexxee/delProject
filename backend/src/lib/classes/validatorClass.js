import { ValidationException } from "./errorClasses.js";

export class ValidatorClass {
  validate(schema, payload) {
    const { error } = schema.validate(payload);
    if (error) {
      error.details.forEach((detail) => {
        const message = detail.message;
        const path = detail.path.join(".");
        throw new ValidationException(message, path);
      });
    }

    return {
      error: null,
      value: payload,
    };
  }
}

export const validator = new ValidatorClass();
