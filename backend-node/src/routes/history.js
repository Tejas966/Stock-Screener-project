import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as companyRepo from '../repositories/companyRepo.js';
import * as historyRepo from '../repositories/historyRepo.js';
import { parseSymbol } from '../services/analysisService.js';
import { ApiError, asyncHandler, notFound } from '../utils/errors.js';
import { normalizeQuery } from '../utils/format.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  res.json({ data: { items: await historyRepo.listForUser(req.user.id, 100) } });
}));

/** POST /api/history { query, symbol } - record which listing the user picked for a query. */
router.post('/', validate(z.object({ query: z.string().transform(normalizeQuery).pipe(z.string().min(1).max(100)), symbol: z.string().max(32).optional() }).strict()),
  asyncHandler(async (req, res) => {
    const { query, symbol } = req.valid.body;
    let companyId = null;
    if (symbol) {
      const company = await companyRepo.findBySymbol(parseSymbol(symbol));
      if (!company) throw notFound('Company');
      companyId = company.id;
    }
    await historyRepo.record(req.user.id, query, companyId);
    res.status(201).json({ data: { recorded: true } });
  }));

router.delete('/', asyncHandler(async (req, res) => {
  res.json({ data: { deleted: await historyRepo.clear(req.user.id) } });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== req.params.id) throw new ApiError(400, 'INVALID_ID', 'Invalid history id');
  if (!(await historyRepo.removeOne(req.user.id, id))) throw notFound('History entry');
  res.status(204).end();
}));

export default router;
