import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import * as companyRepo from '../repositories/companyRepo.js';
import { getUniverse } from '../services/analysisService.js';
import { runSchema, runScreen, screenerSpec } from '../services/screenerService.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.get('/filters', asyncHandler(async (_req, res) => {
  res.json({ data: { fields: screenerSpec.fields, sectors: await companyRepo.listSectors(), sortable_extra: screenerSpec.sortable_extra } });
}));

router.post('/run', validate(runSchema), asyncHandler(async (req, res) => {
  const { criteria, page, page_size: pageSize } = req.valid.body;
  const universe = await getUniverse();
  const result = runScreen(universe.rows, criteria, { page, pageSize });
  res.json({ data: { ...result, criteria, unavailable: universe.unavailable, provider: universe.provider, generated_at: universe.generated_at, analysis_source: universe.analysis_source, snapshot: universe.snapshot } });
}));

export default router;
