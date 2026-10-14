import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { getCompanyBundle, getUniverse } from '../services/analysisService.js';
import { explain } from '../services/geminiService.js';
import { buildOfflineSummary } from '../services/offlineSummary.js';
import { findEntry, sectorStats } from '../services/offlineSnapshot.js';
import { python } from '../services/pythonClient.js';
import { ApiError, asyncHandler } from '../utils/errors.js';

const router = Router();

// Gemini failures for which the built-in summary is offered instead of an error.
const FALLBACK_CODES = new Set(['AI_NOT_CONFIGURED', 'AI_UNAVAILABLE', 'AI_TIMEOUT', 'AI_QUOTA_EXCEEDED',
  'AI_NOT_AUTHORIZED', 'AI_REQUEST_REJECTED', 'AI_INVALID_RESPONSE', 'AI_NO_RESPONSE']);
const PEER_METRICS = ['pe_ratio', 'roe', 'operating_margin', 'revenue_growth', 'debt_to_equity'];

/** POST /api/analysis/:symbol - (re)run the deterministic Python analysis. */
router.post('/:symbol', asyncHandler(async (req, res) => {
  const bundle = await getCompanyBundle(req.params.symbol);
  if (!bundle.analysis) throw new ApiError(503, bundle.analysis_error?.code ?? 'ANALYSIS_UNAVAILABLE', bundle.analysis_error?.message ?? 'Analysis unavailable');
  res.json({ data: { company: bundle.company, analysis: bundle.analysis, analysis_source: bundle.analysis_source, provider: bundle.provider } });
}));

/** Sector peer statistics for the summary: live from Python, else the saved snapshot, else none. */
async function peerStatsFor(company) {
  const slug = company.sector?.slug;
  if (!slug) return null;
  try {
    const universe = await getUniverse();
    const rows = universe.rows.filter((r) => r.company.sector?.slug === slug);
    if (universe.analysis_source === 'live') {
      return await python.statistics(Object.fromEntries(PEER_METRICS.map((k) => [k, rows.map((r) => ({ symbol: r.company.symbol, value: r.metrics[k] ?? null }))])));
    }
  } catch {
    // fall through to the snapshot
  }
  return sectorStats(slug);
}

/** The predefined summary: the saved one if it matches this exact input, otherwise generated now. */
async function offlineExplanation(bundle, reason) {
  const saved = findEntry(bundle.company.symbol, bundle.analysis_input_hash);
  const explanation = saved?.summary ?? buildOfflineSummary(bundle, await peerStatsFor(bundle.company));
  return {
    explanation,
    source: 'offline_rules',
    model: null,
    cached: Boolean(saved),
    generated_at: saved ? saved.generated_at : new Date().toISOString(),
    ungrounded_numbers: [],
    fallback_reason: reason,
  };
}

/**
 * POST /api/analysis/:symbol/explanation   body (optional): { "mode": "auto" | "offline" }
 * auto    - Gemini; if it is not configured or not reachable, the built-in summary.
 * offline - always the built-in rule-based summary (no internet needed).
 * Requires login and is rate limited per user.
 */
router.post('/:symbol/explanation', requireAuth, aiLimiter,
  validate(z.object({ mode: z.enum(['auto', 'offline']).default('auto') }).strict()),
  asyncHandler(async (req, res) => {
    const bundle = await getCompanyBundle(req.params.symbol);
    if (!bundle.analysis) throw new ApiError(409, 'ANALYSIS_REQUIRED', 'Numerical analysis must be available before an explanation can be generated');
    let result;
    if (req.valid.body.mode === 'offline') {
      result = await offlineExplanation(bundle, null);
    } else {
      try {
        result = { ...(await explain(bundle)), source: 'gemini' };
      } catch (err) {
        if (!FALLBACK_CODES.has(err.code)) throw err;
        result = await offlineExplanation(bundle, { code: err.code, message: err.message });
      }
    }
    res.json({
      data: {
        ...result,
        symbol: bundle.company.symbol,
        is_demo_data: bundle.provider.is_demo,
        disclaimer: result.source === 'gemini'
          ? 'AI-generated explanation of the figures shown on this page. It can be wrong or incomplete and is not investment advice.'
          : 'Built-in rule-based summary of the figures shown on this page (not AI). It is not investment advice.',
      },
    });
  }));

export default router;
