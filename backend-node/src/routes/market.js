import { Router } from 'express';
import { getUniverse } from '../services/analysisService.js';
import * as marketData from '../services/marketDataService.js';
import { python } from '../services/pythonClient.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

function oneYearBefore(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

/** GET /api/market/overview - indices (if the provider has them) + universe statistics. */
router.get('/overview', asyncHandler(async (_req, res) => {
  const [idx, universe] = await Promise.all([
    marketData.getIndices().catch((err) => ({ indices: [], error: { code: err.code, message: err.message } })),
    getUniverse(),
  ]);
  const indices = idx.indices.map((i) => {
    const h = i.history;
    const last = h[h.length - 1];
    const prev = h[h.length - 2];
    const yearAgo = last ? h.find((p) => p.date >= oneYearBefore(last.date)) : null;
    return {
      symbol: i.symbol, name: i.name, last: last?.close ?? null, as_of: last?.date ?? null,
      change_pct: prev ? ((last.close / prev.close) - 1) * 100 : null,
      change_1y_pct: yearAgo ? ((last.close / yearAgo.close) - 1) * 100 : null,
      history: h.slice(-260).map((p) => ({ date: p.date, close: p.close })),
    };
  });

  const rows = universe.rows;
  const withChange = rows.filter((r) => r.change_pct != null).sort((a, b) => b.change_pct - a.change_pct);
  const slim = (r) => ({ symbol: r.company.symbol, name: r.company.name, sector: r.company.sector?.name, price: r.price, change_pct: r.change_pct });
  const sectorCounts = {};
  for (const r of rows) sectorCounts[r.company.sector?.name ?? 'Unclassified'] = (sectorCounts[r.company.sector?.name ?? 'Unclassified'] ?? 0) + 1;

  let stats = null;
  try {
    stats = await python.statistics(Object.fromEntries(['pe_ratio', 'roe', 'dividend_yield', 'market_cap_cr'].map((k) => [k, rows.map((r) => ({ symbol: r.company.symbol, value: r.metrics[k] ?? null }))])));
  } catch {
    stats = null;
  }

  res.json({
    data: {
      indices, indices_meta: idx.meta ?? null, indices_error: idx.error ?? null,
      universe: {
        company_count: rows.length, unavailable_count: universe.unavailable.length, sector_counts: sectorCounts,
        advancers: withChange.filter((r) => r.change_pct > 0).length, decliners: withChange.filter((r) => r.change_pct < 0).length,
        top_gainers: withChange.slice(0, 5).map(slim), top_losers: withChange.slice(-5).reverse().map(slim),
        statistics: stats,
        largest: [...rows].filter((r) => r.metrics.market_cap_cr != null).sort((a, b) => b.metrics.market_cap_cr - a.metrics.market_cap_cr).slice(0, 8)
          .map((r) => ({ ...slim(r), market_cap_cr: r.metrics.market_cap_cr, pe_ratio: r.metrics.pe_ratio })),
      },
      data_meta: rows[0]?.data_meta ?? null,
      provider: universe.provider,
      generated_at: universe.generated_at,
      analysis_source: universe.analysis_source,
      snapshot: universe.snapshot,
    },
  });
}));

export default router;
