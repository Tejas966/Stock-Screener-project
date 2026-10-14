/** Research notes - persisted by the PHP service (see savedScreens.js for the pattern). */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { SYMBOL_RE } from '../services/analysisService.js';
import { phpRequest } from '../services/phpClient.js';
import { ApiError, asyncHandler } from '../utils/errors.js';

const title = z.string().trim().min(1, 'Title is required').max(150, 'Title must be at most 150 characters');
const content = z.string().trim().min(1, 'Note text is required').max(10000, 'Note must be at most 10,000 characters');
const symbol = z.string().trim().toUpperCase().regex(SYMBOL_RE, 'Choose a company from the list').nullable().optional();
const createSchema = z.object({ title, content, company_symbol: symbol }).strict();
const updateSchema = z.object({ title: title.optional(), content: content.optional(), company_symbol: symbol }).strict()
  .refine((d) => Object.keys(d).length > 0, 'Provide at least one field to update');
const listSchema = z.object({
  company: z.string().trim().toUpperCase().regex(SYMBOL_RE).optional(),
  limit: z.string().regex(/^\d{1,3}$/).optional(),
  offset: z.string().regex(/^\d{1,6}$/).optional(),
}).strict();

const idParam = (req) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== req.params.id) throw new ApiError(400, 'INVALID_ID', 'Invalid note id');
  return id;
};

const router = Router();
router.use(requireAuth);

router.get('/', validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  res.json({ data: await phpRequest('GET', '/internal/research-notes', req.user.id, { query: req.valid.query }) });
}));
router.get('/:id', asyncHandler(async (req, res) => res.json({ data: await phpRequest('GET', `/internal/research-notes/${idParam(req)}`, req.user.id) })));
router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await phpRequest('POST', '/internal/research-notes', req.user.id, { body: req.valid.body }) });
}));
router.put('/:id', validate(updateSchema), asyncHandler(async (req, res) => {
  res.json({ data: await phpRequest('PUT', `/internal/research-notes/${idParam(req)}`, req.user.id, { body: req.valid.body }) });
}));
router.delete('/:id', asyncHandler(async (req, res) => {
  await phpRequest('DELETE', `/internal/research-notes/${idParam(req)}`, req.user.id);
  res.status(204).end();
}));

export default router;
