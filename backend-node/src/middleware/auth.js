import { config } from '../config.js';
import * as sessionRepo from '../repositories/sessionRepo.js';
import * as userRepo from '../repositories/userRepo.js';
import { unauthorized } from '../utils/errors.js';

export const SESSION_COOKIE = 'fx_session';

export const cookieOptions = () => ({
  httpOnly: true, // not readable by JavaScript -> not stealable via XSS
  sameSite: 'lax', // not sent on cross-site POSTs -> CSRF mitigation
  secure: config.cookieSecure,
  path: '/',
  maxAge: config.sessionTtlHours * 3600 * 1000,
});

/** Attach req.user when a valid session cookie is present (never fails the request). */
export async function loadUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== 'string' || token.length > 100) return next();
  try {
    const userId = await sessionRepo.findUserIdByToken(token);
    if (userId) {
      req.user = await userRepo.findById(userId);
      req.sessionToken = token;
    }
  } catch (err) {
    // Database down: treat as anonymous; protected routes will answer 401/503.
    req.authError = err;
  }
  next();
}

/** Require an authenticated user. The user id ONLY ever comes from the session. */
export function requireAuth(req, _res, next) {
  if (!req.user) {
    if (req.authError) return next(req.authError);
    return next(unauthorized());
  }
  next();
}
