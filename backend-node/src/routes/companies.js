import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import * as companyRepo from '../repositories/companyRepo.js';
import * as historyRepo from '../repositories/historyRepo.js';
import { getCompanyBundle, getCompanyOr404 } from '../services/analysisService.js';
import * as marketData from '../services/marketDataService.js';
import { python } from '../services/pythonClient.js';
import { asyncHandler } from '../utils/errors.js';
import { normalizeQuery } from '../utils/format.js';

const router = Router();

const searchSchema = z.object({
  q: z.string().transform(normalizeQuery)
    .pipe(z.string().min(1, 'Enter a company name or symbol').max(60, 'Search text is too long')
      .regex(/^[\p{L}\p{N} .&'()-]+$/u, 'Search text contains unsupported characters')),
  record: z.enum(['0', '1']).optional(),
}).strict();

/**
 * GET /api/companies/search?q=...
 * Searches the supported universe (MySQL). Several listings of the same
 * company (NSE + BSE) are grouped by ISIN so the UI can disambiguate.
 */
router.get('/search', validate(searchSchema, 'query'), asyncHandler(async (req, res) => {
  const { q, record } = req.valid.query;
  const results = await companyRepo.search(q, 20);
  const upper = q.toUpperCase();
  const exact = results.filter((c) => c.ticker === upper || c.symbol === upper);
  const groups = new Map();
  for (const c of results) {
    const key = c.isin || c.name;
    if (!groups.has(key)) groups.set(key, { name: c.name, isin: c.isin, sector: c.sector, industry: c.industry, listings: [] });
    groups.get(key).listings.push({ symbol: c.symbol, ticker: c.ticker, exchange: c.exchange });
  }
  if (req.user && record !== '0') {
    const resolved = exact.length === 1 ? exact[0].id : null;
    historyRepo.record(req.user.id, q, resolved).catch((err) => console.warn(`[history] ${err.code || err.message}`));
  }
  res.json({
    data: {
      query: q,
      results,
      groups: [...groups.values()],
      exact_match: exact.length === 1 ? exact[0].symbol : null,
      ambiguous: groups.size > 1 || [...groups.values()].some((g) => g.listings.length > 1),
    },
  });
}));

router.get('/featured', asyncHandler(async (_req, res) => {
  const all = await companyRepo.listAll();
  res.json({ data: all.filter((c) => c.featured) });
}));

router.get('/', asyncHandler(async (_req, res) => {
  res.json({ data: await companyRepo.listAll({ primaryOnly: true }) });
}));

/** GET /api/companies/:symbol - identity, quote and other listings of the same company. */
router.get('/:symbol', asyncHandler(async (req, res) => {
  const company = await getCompanyOr404(req.params.symbol);
  const listings = company.isin ? (await companyRepo.search(company.isin, 5)).filter((c) => c.isin === company.isin) : [company];
  let quote = null;
  let quoteError = null;
  try {
    const q = await marketData.getQuote(company);
    quote = { ...q.data, meta: q.meta };
  } catch (err) {
    quoteError = { code: err.code, message: err.message };
  }
  res.json({ data: { company, listings: listings.map((l) => ({ symbol: l.symbol, exchange: l.exchange, ticker: l.ticker })), quote, quote_error: quoteError } });
}));

/** GET /api/companies/:symbol/fundamentals - company + quote + statements + Python analysis. */
router.get('/:symbol/fundamentals', asyncHandler(async (req, res) => {
  res.json({ data: await getCompanyBundle(req.params.symbol) });
}));

const statementsSchema = z.object({
  type: z.enum(['income', 'balance', 'cashflow']).optional(),
  period: z.enum(['annual', 'quarterly']).default('annual'),
}).strict();

/** GET /api/companies/:symbol/statements?type=income&period=annual */
router.get('/:symbol/statements', validate(statementsSchema, 'query'), asyncHandler(async (req, res) => {
  const company = await getCompanyOr404(req.params.symbol);
  const { type, period } = req.valid.query;
  const s = await marketData.getStatements(company);
  const periods = s.data.filter((p) => p.period_type === period).map((p) => (type
    ? { fiscal_year: p.fiscal_year, fiscal_period: p.fiscal_period, period_type: p.period_type, period_end: p.period_end, currency: p.currency, [type]: p[type] }
    : p));
  res.json({ data: { company, period, type: type ?? 'all', unit: 'absolute', periods, meta: s.meta } });
}));

const RANGE_MONTHS = { '1M': 1, '6M': 6, '1Y': 12, '3Y': 36, '5Y': 60 };
const historySchema = z.object({ range: z.enum(Object.keys(RANGE_MONTHS)).default('1Y') }).strict();

/** GET /api/companies/:symbol/history?range=1Y - close prices + Python return statistics. */
router.get('/:symbol/history', validate(historySchema, 'query'), asyncHandler(async (req, res) => {
  const company = await getCompanyOr404(req.params.symbol);
  const { range } = req.valid.query;
  const h = await marketData.getHistory(company);
  const prices = h.data;
  let returns = null;
  let returnsError = null;
  try {
    returns = await python.returns(prices.map(({ date, close }) => ({ date, close })));
  } catch (err) {
    returnsError = { code: err.code, message: err.message };
  }
  let series = prices;
  if (prices.length) {
    const cutoff = new Date(`${prices[prices.length - 1].date}T00:00:00Z`);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - RANGE_MONTHS[range]);
    const iso = cutoff.toISOString().slice(0, 10);
    series = prices.filter((p) => p.date >= iso);
  }
  const available = prices.length ? { from: prices[0].date, to: prices[prices.length - 1].date } : null;
  res.json({ data: { company, range, prices: series, available, returns, returns_error: returnsError, meta: h.meta } });
}));

export default router;
