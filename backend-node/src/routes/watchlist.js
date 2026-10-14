import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as watchlistRepo from '../repositories/watchlistRepo.js';
import { getCompanyOr404, getRowsForCompanies } from '../services/analysisService.js';
import * as companyRepo from '../repositories/companyRepo.js';
import { ApiError, asyncHandler, notFound } from '../utils/errors.js';

const MAX_ITEMS = 50;
const router = Router();
router.use(requireAuth);

/** GET /api/watchlist - saved companies with latest available price and selected ratios. */
router.get('/', asyncHandler(async (req, res) => {
  const items = await watchlistRepo.listForUser(req.user.id);
  const companies = await Promise.all(items.map((i) => companyRepo.findById(i.company_id)));
  const { rows, unavailable } = companies.length ? await getRowsForCompanies(companies) : { rows: [], unavailable: [] };
  const bySymbol = new Map(rows.map((r) => [r.company.symbol, r]));
  res.json({
    data: {
      items: items.map((i, idx) => ({
        id: i.id, added_at: i.added_at, company: companies[idx],
        row: bySymbol.get(i.symbol) ?? null,
        error: unavailable.find((u) => u.symbol === i.symbol)?.error ?? null,
      })),
      max_items: MAX_ITEMS,
    },
  });
}));

router.post('/', validate(z.object({ symbol: z.string().min(1).max(32) }).strict()), asyncHandler(async (req, res) => {
  const company = await getCompanyOr404(req.valid.body.symbol);
  if ((await watchlistRepo.count(req.user.id)) >= MAX_ITEMS) throw new ApiError(409, 'WATCHLIST_FULL', `A watchlist can hold at most ${MAX_ITEMS} companies`);
  const id = await watchlistRepo.add(req.user.id, company.id);
  if (id === null) throw new ApiError(409, 'ALREADY_IN_WATCHLIST', `${company.name} is already in your watchlist`);
  res.status(201).json({ data: { id, company } });
}));

router.delete('/:itemId', asyncHandler(async (req, res) => {
  const itemId = Number.parseInt(req.params.itemId, 10);
  if (!Number.isInteger(itemId) || itemId <= 0 || String(itemId) !== req.params.itemId) throw new ApiError(400, 'INVALID_ID', 'Invalid watchlist item id');
  if (!(await watchlistRepo.remove(req.user.id, itemId))) throw notFound('Watchlist item');
  res.status(204).end();
}));

export default router;
