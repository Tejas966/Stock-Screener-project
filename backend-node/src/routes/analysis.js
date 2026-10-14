import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/security.js';
import { getCompanyBundle } from '../services/analysisService.js';
import { explain } from '../services/geminiService.js';
import { ApiError, asyncHandler } from '../utils/errors.js';

const router = Router();

/** POST /api/analysis/:symbol - (re)run the deterministic Python analysis. */
router.post('/:symbol', asyncHandler(async (req, res) => {
  const bundle = await getCompanyBundle(req.params.symbol);
  if (!bundle.analysis) throw new ApiError(503, bundle.analysis_error?.code ?? 'ANALYSIS_UNAVAILABLE', bundle.analysis_error?.message ?? 'Analysis unavailable');
  res.json({ data: { company: bundle.company, analysis: bundle.analysis, provider: bundle.provider } });
}));

/**
 * POST /api/analysis/:symbol/explanation - Gemini explanation of the numbers.
 * Requires login (protects the AI quota) and is rate limited per user.
 */
router.post('/:symbol/explanation', requireAuth, aiLimiter, asyncHandler(async (req, res) => {
  const bundle = await getCompanyBundle(req.params.symbol);
  const result = await explain(bundle);
  res.json({
    data: {
      ...result,
      symbol: bundle.company.symbol,
      is_demo_data: bundle.provider.is_demo,
      disclaimer: 'AI-generated explanation of the figures shown on this page. It can be wrong or incomplete and is not investment advice.',
    },
  });
}));

export default router;
