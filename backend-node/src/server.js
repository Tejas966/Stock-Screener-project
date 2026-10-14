import { config } from './config.js';
import { createApp } from './app.js';
import { closePool } from './db/pool.js';
import { getProvider } from './services/providers/index.js';

const provider = getProvider(); // fail fast on an unknown provider name
if (!config.services.phpSecret || config.services.phpSecret.length < 16) {
  console.error('PHP_SERVICE_SECRET must be set (16+ characters) in .env');
  process.exit(1);
}

const server = createApp().listen(config.port, '127.0.0.1', () => {
  console.log(`FundamentalX API listening on http://127.0.0.1:${config.port}`);
  console.log(`  data provider : ${provider.name}${provider.isDemo ? ' (ILLUSTRATIVE demo data)' : ''}`);
  console.log(`  python service: ${config.services.pythonUrl}`);
  console.log(`  php service   : ${config.services.phpUrl}`);
  console.log(`  gemini        : ${config.gemini.apiKey ? config.gemini.model : 'not configured (AI explanations disabled)'}`);
});

const shutdown = () => server.close(async () => { await closePool(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
