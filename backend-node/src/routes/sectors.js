import { Router } from 'express';
import * as companyRepo from '../repositories/companyRepo.js';
import { getUniverse } from '../services/analysisService.js';
import { python } from '../services/pythonClient.js';
import { ApiError, asyncHandler, notFound } from '../utils/errors.js';

const STAT_METRICS = ['pe_ratio', 'pb_ratio', 'ev_ebitda', 'dividend_yield', 'roe', 'roce', 'operating_margin', 'net_margin',
  'revenue_growth', 'net_income_growth', 'debt_to_equity', 'current_ratio', 'market_cap_cr'];

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const [sectors, companies] = await Promise.all([companyRepo.listSectors(), companyRepo.listAll({ primaryOnly: true })]);
  res.json({
    data: sectors.map((s) => ({ ...s, companies: companies.filter((c) => c.sector?.slug === s.slug).map((c) => ({ name: c.name, symbol: c.symbol })) })),
  });
}));

/** GET /api/sectors/:slug - peer table + Python descriptive statistics. */
router.get('/:slug', asyncHandler(async (req, res) => {
  const slug = String(req.params.slug);
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw new ApiError(400, 'INVALID_SECTOR', 'Invalid sector');
  const sector = await companyRepo.findSectorBySlug(slug);
  if (!sector) throw notFound('Sector');
  const universe = await getUniverse();
  const rows = universe.rows.filter((r) => r.company.sector?.slug === slug);
  let statistics = null;
  let statisticsError = null;
  if (rows.length) {
    try {
      statistics = await python.statistics(Object.fromEntries(STAT_METRICS.map((k) => [k, rows.map((r) => ({ symbol: r.company.symbol, value: r.metrics[k] ?? null }))])));
    } catch (err) {
      statisticsError = { code: err.code, message: err.message };
    }
  }
  res.json({
    data: {
      sector, peer_group: rows.map((r) => r.company.symbol), peer_count: rows.length, rows, statistics, statistics_error: statisticsError,
      unavailable: universe.unavailable.filter((u) => rows.every((r) => r.company.symbol !== u.symbol)), provider: universe.provider,
    },
  });
}));

export default router;
