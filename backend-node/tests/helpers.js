/**
 * Test helpers: stub Python/PHP services (so tests never need the real ones)
 * and environment setup BEFORE the app modules read their configuration.
 */
import { createServer } from 'node:http';

export function startStub(handler) {
  return new Promise((resolve) => {
    const calls = [];
    const server = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      const call = { method: req.method, url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null };
      calls.push(call);
      const { status = 200, json } = (await handler(call)) ?? {};
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(json === undefined ? '' : JSON.stringify(json));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }));
  });
}

/** Minimal Python /v1/analyze response built from the request (enough for routing tests). */
export function fakeAnalysis(payload) {
  const annual = payload.periods.filter((p) => p.period_type === 'annual');
  const latest = annual[annual.length - 1];
  const metric = (key, value) => ({ key, label: key, value, unit: 'ratio', status: value == null ? 'unavailable' : 'calculated', reason: null, flags: [] });
  const pe = payload.market.price && latest?.income?.eps > 0 ? payload.market.price / latest.income.eps : null;
  return {
    symbol: payload.symbol, engine_version: 'stub', currency: 'INR',
    latest_annual_period: latest ? { fiscal_year: latest.fiscal_year, period_end: latest.period_end } : null,
    valuation: { pe_ratio: metric('pe_ratio', pe), market_cap: metric('market_cap', payload.market.price * payload.market.shares_outstanding) },
    latest: { profitability: { roe: metric('roe', 20) }, health: {}, cashflow: {}, growth: {} },
    series: [], quarterly: [], cagr: {},
    key_metrics: { pe_ratio: pe, roe: 20, market_cap: payload.market.price * payload.market.shares_outstanding, debt_to_equity: null },
    quality: { checks: [], completeness: { overall_pct: 100 } }, warnings: [],
  };
}

export function pythonHandler(state = { down: false }) {
  return ({ url, body }) => {
    if (state.down) return { status: 500, json: { detail: 'down' } };
    if (url === '/health') return { json: { status: 'ok' } };
    if (url === '/v1/analyze') return { json: fakeAnalysis(body) };
    if (url === '/v1/analyze/batch') return { json: { results: body.items.map(fakeAnalysis) } };
    if (url === '/v1/returns') return { json: { windows: {}, return_type: 'price_return_excluding_dividends' } };
    if (url === '/v1/statistics') return { json: { statistics: {} } };
    return { status: 404, json: {} };
  };
}

export const TEST_PHP_SECRET = 'node-test-php-secret-0123456789';

export function setTestEnv({ pythonUrl, phpUrl }) {
  process.env.NODE_ENV = 'test';
  process.env.PYTHON_SERVICE_URL = pythonUrl;
  process.env.PHP_SERVICE_URL = phpUrl;
  process.env.PHP_SERVICE_SECRET = TEST_PHP_SECRET;
  process.env.PYTHON_SERVICE_SECRET = '';
  process.env.FINANCIAL_PROVIDER = 'demo';
  process.env.GEMINI_API_KEY = '';
  process.env.SERVICE_TIMEOUT_MS = '1500';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
}
