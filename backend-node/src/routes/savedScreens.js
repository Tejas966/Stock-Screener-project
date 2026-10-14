/**
 * Saved screens - persisted by the PHP service. Node authenticates the user,
 * validates the payload (PHP validates again), then forwards the request.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { phpRequest } from '../services/phpClient.js';
import { criteriaSchema } from '../services/screenerService.js';
import { ApiError, asyncHandler } from '../utils/errors.js';

const name = z.string().trim().min(1, 'Name is required').max(80, 'Name must be at most 80 characters');
const description = z.string().trim().max(300, 'Description must be at most 300 characters').nullable().optional();
const createSchema = z.object({ name, description, criteria: criteriaSchema }).strict();
const updateSchema = z.object({ name: name.optional(), description, criteria: criteriaSchema.optional() }).strict()
  .refine((d) => Object.keys(d).length > 0, 'Provide at least one field to update');

const idParam = (req) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== req.params.id) throw new ApiError(400, 'INVALID_ID', 'Invalid saved screen id');
  return id;
};

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => res.json({ data: await phpRequest('GET', '/internal/saved-screens', req.user.id) })));
router.get('/:id', asyncHandler(async (req, res) => res.json({ data: await phpRequest('GET', `/internal/saved-screens/${idParam(req)}`, req.user.id) })));
router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await phpRequest('POST', '/internal/saved-screens', req.user.id, { body: req.valid.body }) });
}));
router.put('/:id', validate(updateSchema), asyncHandler(async (req, res) => {
  res.json({ data: await phpRequest('PUT', `/internal/saved-screens/${idParam(req)}`, req.user.id, { body: req.valid.body }) });
}));
router.delete('/:id', asyncHandler(async (req, res) => {
  await phpRequest('DELETE', `/internal/saved-screens/${idParam(req)}`, req.user.id);
  res.status(204).end();
}));

export default router;
