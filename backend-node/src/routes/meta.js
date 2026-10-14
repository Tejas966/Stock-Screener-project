import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { phpHealth } from '../services/phpClient.js';
import { getProvider } from '../services/providers/index.js';
import { DEMO_AS_OF } from '../services/providers/demoProvider.js';
import { python } from '../services/pythonClient.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

/** Public configuration the UI needs (no secrets). */
router.get('/meta', (_req, res) => {
  const p = getProvider();
  res.json({
    data: {
      app: 'FundamentalX',
      provider: { name: p.name, label: p.label, is_demo: p.isDemo, demo_as_of: p.isDemo ? DEMO_AS_OF : null },
      ai: { configured: Boolean(config.gemini.apiKey), model: config.gemini.apiKey ? config.gemini.model : null },
      supported_exchanges: config.provider.exchanges,
    },
  });
});

/** Health of every service the gateway depends on. */
router.get('/health', asyncHandler(async (_req, res) => {
  const [db, py, php] = await Promise.all([
    query('SELECT 1').then(() => true).catch(() => false),
    python.health(),
    phpHealth(),
  ]);
  const ok = db && py && php;
  res.status(ok ? 200 : 503).json({ data: { status: ok ? 'ok' : 'degraded', services: { node: true, mysql: db, python: py, php } } });
}));

export default router;
