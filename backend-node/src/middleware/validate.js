import { ApiError } from '../utils/errors.js';

/** Turn zod issues into { "field.path": "message" }. */
export function zodDetails(error) {
  const details = {};
  for (const issue of error.issues) details[issue.path.join('.') || 'body'] ??= issue.message;
  return details;
}

/** Validate req[part] against a zod schema; replaces it with the parsed value on req.valid[part]. */
export const validate = (schema, part = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[part] ?? {});
  if (!result.success) return next(new ApiError(422, 'VALIDATION_FAILED', 'One or more fields are invalid', zodDetails(result.error)));
  req.valid ??= {};
  req.valid[part] = result.data;
  next();
};
