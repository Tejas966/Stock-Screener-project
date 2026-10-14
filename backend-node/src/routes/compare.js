import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { getCompanyBundle, metricRow, SYMBOL_RE } from '../services/analysisService.js';
import { ApiError, asyncHandler } from '../utils/errors.js';
import { CRORE } from '../utils/format.js';

const compareSchema = z.object({
  symbols: z.array(z.string().trim().toUpperCase().regex(SYMBOL_RE, 'Invalid symbol')).min(2, 'Select at least two companies').max(5, 'Compare at most five companies'),
}).strict().refine((d) => new Set(d.symbols).size === d.symbols.length, { path: ['symbols'], message: 'Each company can only be selected once' });

const router = Router();

/** POST /api/compare { symbols: [...] } */
router.post('/', validate(compareSchema), asyncHandler(async (req, res) => {
  const settled = await Promise.allSettled(req.valid.body.symbols.map((s) => getCompanyBundle(s)));
  const failed = settled.map((r, i) => (r.status === 'rejected' ? { symbol: req.valid.body.symbols[i], error: { code: r.reason?.code, message: r.reason?.message } } : null)).filter(Boolean);
  const bundles = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (bundles.length < 2) throw new ApiError(422, 'COMPARE_INSUFFICIENT', 'At least two of the selected companies must have data to compare', { failed });

  const companies = bundles.map((b) => ({
    ...metricRow(b.company, b.quote, b.analysis),
    analysis_available: Boolean(b.analysis),
    meta: b.quote?.meta ?? b.statements?.meta,
    trend: (b.statements?.periods ?? []).filter((p) => p.period_type === 'annual').map((p) => ({
      fiscal_year: p.fiscal_year,
      revenue_cr: p.income?.revenue == null ? null : p.income.revenue / CRORE,
      net_income_cr: p.income?.net_income == null ? null : p.income.net_income / CRORE,
    })),
  }));

  const warnings = [];
  const sectors = new Set(companies.map((c) => c.company.sector?.slug));
  if (sectors.size > 1) warnings.push('The selected companies are in different sectors. Margins, leverage and valuation norms differ by sector, so compare with care.');
  if (sectors.has('banking') && sectors.size > 1) warnings.push('Banks are included: industrial ratios such as current ratio, ROCE and EV/EBITDA are not meaningful for them and are shown as not applicable.');
  const years = new Set(companies.map((c) => c.latest_period?.fiscal_year).filter(Boolean));
  if (years.size > 1) warnings.push('Latest fiscal years differ between companies; figures are not from the same reporting period.');
  const currencies = new Set(bundles.map((b) => b.analysis?.currency ?? b.company.currency));
  if (currencies.size > 1) warnings.push('Companies report in different currencies; absolute amounts are not comparable.');

  res.json({ data: { companies, failed, warnings, provider: bundles[0].provider } });
}));

export default router;
