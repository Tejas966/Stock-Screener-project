/**
 * Central configuration. Values come from the project-root .env file (or real
 * environment variables, which take precedence). Secrets have no defaults.
 */
import { config as loadEnv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
loadEnv({ path: join(root, '.env'), quiet: true });

const env = process.env;
const int = (v, d) => (v === undefined || v === '' ? d : Number.parseInt(v, 10));
const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));
const list = (v, d) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);

export const config = {
  rootDir: root,
  env: env.NODE_ENV || 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: int(env.NODE_PORT, 4000),
  corsOrigins: list(env.CORS_ORIGINS, ['http://localhost:5173', 'http://127.0.0.1:5173']),
  sessionTtlHours: int(env.SESSION_TTL_HOURS, 72),
  cookieSecure: bool(env.COOKIE_SECURE, env.NODE_ENV === 'production'),

  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: int(env.DB_PORT, 3306),
    database: env.NODE_ENV === 'test' ? env.DB_TEST_NAME || 'fundamentalx_test' : env.DB_NAME || 'fundamentalx',
    user: env.DB_USER || 'fundamentalx',
    password: env.DB_PASSWORD || '',
  },

  services: {
    pythonUrl: env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8001',
    phpUrl: env.PHP_SERVICE_URL || 'http://127.0.0.1:8002',
    phpSecret: env.PHP_SERVICE_SECRET || '',
    pythonSecret: env.PYTHON_SERVICE_SECRET || '',
    timeoutMs: int(env.SERVICE_TIMEOUT_MS, 5000),
  },

  provider: {
    name: (env.FINANCIAL_PROVIDER || 'demo').toLowerCase(),
    apiKey: env.FINANCIAL_PROVIDER_API_KEY || '',
    baseUrl: env.FINANCIAL_PROVIDER_BASE_URL || 'https://financialmodelingprep.com/stable',
    timeoutMs: int(env.PROVIDER_TIMEOUT_MS, 8000),
    exchanges: list(env.SUPPORTED_EXCHANGES, ['NSE', 'BSE']),
  },

  cacheTtl: {
    quote: int(env.CACHE_TTL_QUOTE_SECONDS, 900),
    history: int(env.CACHE_TTL_HISTORY_SECONDS, 43200),
    statements: int(env.CACHE_TTL_STATEMENTS_SECONDS, 86400),
  },

  gemini: {
    apiKey: env.GEMINI_API_KEY || '',
    model: env.GEMINI_MODEL || 'gemini-2.5-flash',
    timeoutMs: int(env.GEMINI_TIMEOUT_MS, 20000),
    ratePerHour: int(env.AI_RATE_LIMIT_PER_HOUR, 20),
  },
};
