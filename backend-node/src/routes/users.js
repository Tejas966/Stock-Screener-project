import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as sessionRepo from '../repositories/sessionRepo.js';
import * as userRepo from '../repositories/userRepo.js';
import { ApiError, asyncHandler } from '../utils/errors.js';
import { nameSchema, passwordSchema, publicUser } from './auth.js';

const profileSchema = z.object({
  name: nameSchema.optional(),
  preferred_period: z.enum(['annual', 'quarterly']).optional(),
  preferred_unit: z.enum(['crore', 'lakh']).optional(),
}).strict().refine((d) => Object.keys(d).length > 0, 'Provide at least one field to update');

const passwordChangeSchema = z.object({ current_password: z.string().min(1).max(128), new_password: passwordSchema }).strict();

const router = Router();
router.use(requireAuth);

router.put('/me', validate(profileSchema), asyncHandler(async (req, res) => {
  await userRepo.updateProfile(req.user.id, req.valid.body);
  res.json({ data: publicUser(await userRepo.findById(req.user.id)) });
}));

router.put('/me/password', validate(passwordChangeSchema), asyncHandler(async (req, res) => {
  const hash = await userRepo.findPasswordHash(req.user.id);
  if (!(await bcrypt.compare(req.valid.body.current_password, hash))) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'Current password is incorrect', { current_password: 'Incorrect password' });
  }
  await userRepo.updatePassword(req.user.id, await bcrypt.hash(req.valid.body.new_password, 12));
  await sessionRepo.deleteOtherSessions(req.user.id, req.sessionToken); // sign out other devices
  res.status(204).end();
}));

export default router;
