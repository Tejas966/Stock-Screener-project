import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { cookieOptions, requireAuth, SESSION_COOKIE } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import * as sessionRepo from '../repositories/sessionRepo.js';
import * as userRepo from '../repositories/userRepo.js';
import { ApiError, asyncHandler } from '../utils/errors.js';

const BCRYPT_ROUNDS = 12;
// A real hash of a random string: comparing against it keeps login timing
// similar whether or not the email exists (prevents account enumeration).
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', 10);

export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a digit');
const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));
export const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long');

const registerSchema = z.object({
  name: nameSchema, email: emailSchema, password: passwordSchema, password_confirmation: z.string(),
}).strict().refine((d) => d.password === d.password_confirmation, { path: ['password_confirmation'], message: 'Passwords do not match' });

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Password is required').max(128) }).strict();

export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, preferred_period: u.preferred_period, preferred_unit: u.preferred_unit, created_at: u.created_at,
});

async function startSession(res, userId) {
  const { token } = await sessionRepo.createSession(userId, config.sessionTtlHours);
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password } = req.valid.body;
  if (await userRepo.findByEmail(email)) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists', { email: 'Email already registered' });
  }
  const id = await userRepo.create({ name, email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  await startSession(res, id);
  res.status(201).json({ data: publicUser(await userRepo.findById(id)) });
}));

router.post('/login', authLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.valid.body;
  const user = await userRepo.findByEmail(email);
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  await startSession(res, user.id);
  sessionRepo.purgeExpired().catch(() => {});
  res.json({ data: publicUser(await userRepo.findById(user.id)) });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  if (req.sessionToken) await sessionRepo.deleteSession(req.sessionToken);
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
}));

router.get('/me', requireAuth, (req, res) => res.json({ data: publicUser(req.user) }));

export default router;
