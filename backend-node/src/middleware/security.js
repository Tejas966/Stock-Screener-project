import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';

const limiterHandler = (code, message) => (_req, _res, next) => next(new ApiError(429, code, message));

/** Login/register: slow down credential stuffing. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: config.isTest ? 1000 : 20, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: limiterHandler('TOO_MANY_ATTEMPTS', 'Too many attempts. Please wait a few minutes and try again.'),
});

/** AI explanations: protect the Gemini quota (keyed by user when logged in). */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: config.isTest ? 1000 : config.gemini.ratePerHour, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
  handler: limiterHandler('AI_RATE_LIMITED', 'You have requested many AI explanations recently. Please try again later.'),
});

/** General API ceiling per IP. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, limit: config.isTest ? 10000 : 300, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: limiterHandler('RATE_LIMITED', 'Too many requests. Please slow down.'),
});

/**
 * CSRF defence in depth (cookies are already SameSite=Lax):
 * state-changing requests must be JSON and, if the browser sends an Origin,
 * it must be one of the allowed origins.
 */
export function requireSafeOrigin(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !config.corsOrigins.includes(origin)) return next(new ApiError(403, 'FORBIDDEN_ORIGIN', 'Request origin is not allowed'));
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body !== undefined && !req.is('application/json')) {
    return next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json'));
  }
  next();
}
