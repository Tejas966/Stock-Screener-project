import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';

/** Consistent error JSON: { error: { code, message, details? } }. Never leaks stack traces. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let e = err;
  if (err?.type === 'entity.too.large') e = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  else if (err?.type === 'entity.parse.failed') e = new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  else if (err?.code && /^(ECONNREFUSED|ER_|PROTOCOL_|ETIMEDOUT)/.test(err.code)) {
    console.error(`[db] ${req.method} ${req.path}: ${err.code}`);
    e = new ApiError(503, 'DATABASE_UNAVAILABLE', 'The database is currently unavailable');
  } else if (!(err instanceof ApiError)) {
    console.error(`[error] ${req.method} ${req.path}:`, config.isProduction ? err?.message : err);
    e = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side');
  }
  const body = { error: { code: e.code, message: e.message } };
  if (e.details) body.error.details = e.details;
  res.status(e.status).json(body);
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No API route for ${req.method} ${req.path}` } });
}
