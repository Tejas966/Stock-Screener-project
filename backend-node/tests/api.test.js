/**
 * HTTP-level tests of the Express gateway (supertest) against the MySQL TEST
 * database, with stubbed Python and PHP services.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { pythonHandler, setTestEnv, startStub, TEST_PHP_SECRET } from './helpers.js';

const pyState = { down: false };
const python = await startStub(pythonHandler(pyState));
const phpState = { down: false };
const php = await startStub(({ method, url, headers, body }) => {
  if (phpState.down) return { status: 503, json: { error: { code: 'DATABASE_UNAVAILABLE', message: 'x' } } };
  if (headers['x-internal-secret'] !== TEST_PHP_SECRET) return { status: 401, json: { error: { code: 'UNAUTHORIZED_SERVICE', message: 'bad' } } };
  if (method === 'GET' && url === '/internal/saved-screens') return { json: { data: { items: [] } } };
  if (method === 'POST' && url === '/internal/saved-screens') return { status: 201, json: { data: { id: 7, ...body, owner: headers['x-user-id'] } } };
  if (method === 'DELETE' && url === '/internal/saved-screens/404') return { status: 404, json: { error: { code: 'NOT_FOUND', message: 'Saved screen not found' } } };
  if (method === 'POST' && url === '/internal/research-notes') return { status: 201, json: { data: { id: 1, ...body, owner: headers['x-user-id'] } } };
  return { status: 404, json: { error: { code: 'NOT_FOUND', message: 'nf' } } };
});
setTestEnv({ pythonUrl: python.url, phpUrl: php.url });

const { migrate } = await import('../scripts/db-migrate.js');
const { seed } = await import('../scripts/db-seed.js');
const { createApp } = await import('../src/app.js');
const { closePool } = await import('../src/db/pool.js');
const { clearAnalysisCaches } = await import('../src/services/analysisService.js');
const { clearMemoryCache } = await import('../src/services/marketDataService.js');

const app = createApp();
const ORIGIN = 'http://localhost:5173';

async function registerAgent(email, password = 'Passw0rd!') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').set('Origin', ORIGIN)
    .send({ name: 'Tester', email, password, password_confirmation: password });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return agent;
}

before(async () => {
  await migrate({ resetFirst: true, log: () => {} });
  await seed({ log: () => {}, demoUser: false });
});

after(async () => {
  await closePool();
  await python.close();
  await php.close();
});

describe('authentication', () => {
  test('register validates input on the server', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: 'short', password_confirmation: 'x' });
    assert.equal(res.status, 422);
    assert.ok(res.body.error.details.email);
    assert.ok(res.body.error.details.password);
    assert.ok(res.body.error.details.name);
  });

  test('register -> me -> logout -> me', async () => {
    const agent = await registerAgent('flow@example.com');
    const me = await agent.get('/api/auth/me');
    assert.equal(me.body.data.email, 'flow@example.com');
    assert.equal(me.body.data.password_hash, undefined, 'never expose the hash');
    assert.equal((await agent.post('/api/auth/logout').set('Origin', ORIGIN)).status, 204);
    assert.equal((await agent.get('/api/auth/me')).body.data, null);
  });

  test('session cookie is httpOnly and SameSite', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Cookie', email: 'cookie@example.com', password: 'Passw0rd!', password_confirmation: 'Passw0rd!' });
    const cookie = res.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
  });

  test('duplicate email is rejected (case-insensitive)', async () => {
    await registerAgent('dupe@example.com');
    const res = await request(app).post('/api/auth/register').send({ name: 'Dupe', email: 'DUPE@example.com', password: 'Passw0rd!', password_confirmation: 'Passw0rd!' });
    assert.equal(res.status, 409);
  });

  test('login with wrong password fails without revealing which part was wrong', async () => {
    await registerAgent('login@example.com', 'Corr3ctPass');
    const bad = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'wrong123' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong123' });
    assert.equal(bad.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(bad.body.error.message, unknown.body.error.message);
    const ok = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'Corr3ctPass' });
    assert.equal(ok.status, 200);
  });

  test('forged or garbage cookies are treated as anonymous', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'fx_session=forged-token');
    assert.equal(res.status, 200);
    assert.equal(res.body.data, null);
    assert.equal((await request(app).get('/api/watchlist').set('Cookie', 'fx_session=forged-token')).status, 401);
  });

  test('protected routes require login', async () => {
    for (const path of ['/api/watchlist', '/api/history', '/api/saved-screens', '/api/research-notes']) {
      assert.equal((await request(app).get(path)).status, 401, path);
    }
  });
});

describe('security middleware', () => {
  test('cross-origin state-changing requests are refused', async () => {
    const res = await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'a@b.co', password: 'x' });
    assert.equal(res.status, 403);
  });

  test('non-JSON bodies are refused for writes', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'text/plain').send('email=a');
    assert.equal(res.status, 415);
  });

  test('oversized bodies are refused', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(40000) });
    assert.equal(res.status, 413);
  });

  test('security headers are set and no stack traces leak', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.ok(!JSON.stringify(res.body).includes('at '));
  });
});

describe('companies and analysis', () => {
  test('search validates the query', async () => {
    assert.equal((await request(app).get('/api/companies/search?q=')).status, 422);
    assert.equal((await request(app).get(`/api/companies/search?q=${'a'.repeat(61)}`)).status, 422);
    assert.equal((await request(app).get('/api/companies/search?q=%3Cscript%3E')).status, 422);
  });

  test('search groups NSE and BSE listings of the same company', async () => {
    const res = await request(app).get('/api/companies/search?q=Reliance');
    assert.equal(res.status, 200);
    const group = res.body.data.groups.find((g) => g.isin === 'INE002A01018');
    assert.deepEqual(group.listings.map((l) => l.exchange).sort(), ['BSE', 'NSE']);
    assert.equal(res.body.data.ambiguous, true);
  });

  test('exact ticker match resolves', async () => {
    const res = await request(app).get('/api/companies/search?q=infy');
    assert.equal(res.body.data.exact_match, 'INFY.NS');
  });

  test('empty search returns no results (not an error)', async () => {
    const res = await request(app).get('/api/companies/search?q=zzzznotacompany');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.results, []);
  });

  test('invalid and unknown symbols', async () => {
    assert.equal((await request(app).get('/api/companies/not a symbol/fundamentals')).status, 400);
    assert.equal((await request(app).get('/api/companies/UNKNOWN.NS/fundamentals')).status, 404);
  });

  test('fundamentals combine demo data, normalized statements and Python analysis', async () => {
    const res = await request(app).get('/api/companies/TCS.NS/fundamentals');
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.provider.is_demo, true);
    assert.equal(d.quote.meta.is_demo, true);
    assert.ok(d.statements.periods.length >= 5);
    assert.ok(d.statements.periods[0].income.revenue > 1e10, 'crore converted to rupees');
    assert.ok(d.analysis.key_metrics.pe_ratio > 0);
    const sent = python.calls.find((c) => c.url === '/v1/analyze').body;
    assert.equal(sent.symbol, 'TCS.NS');
    assert.ok(sent.periods.every((p) => !('reported_at' in p)), 'payload matches the Python schema');
    assert.ok(sent.periods.every((p) => !p.cashflow || p.cashflow.capital_expenditure >= 0), 'capex normalized');
  });

  test('second request is served from cache', async () => {
    const res = await request(app).get('/api/companies/TCS.NS');
    assert.equal(res.body.data.quote.meta.cache_status, 'cached');
  });

  test('Python outage does not hide raw statements', async () => {
    clearAnalysisCaches();
    pyState.down = true;
    try {
      const res = await request(app).get('/api/companies/INFY.NS/fundamentals');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.analysis, null);
      assert.equal(res.body.data.analysis_error.code, 'ANALYSIS_SERVICE_UNAVAILABLE');
      assert.ok(res.body.data.statements.periods.length > 0);
    } finally {
      pyState.down = false;
    }
  });

  test('AI explanation needs login, then reports when Gemini is not configured', async () => {
    assert.equal((await request(app).post('/api/analysis/TCS.NS/explanation')).status, 401);
    const agent = await registerAgent('ai@example.com');
    const res = await agent.post('/api/analysis/TCS.NS/explanation').set('Origin', ORIGIN);
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'AI_NOT_CONFIGURED');
  });

  test('statements and history endpoints validate their query parameters', async () => {
    assert.equal((await request(app).get('/api/companies/TCS.NS/statements?type=bogus')).status, 422);
    const ok = await request(app).get('/api/companies/TCS.NS/statements?type=income&period=quarterly');
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.periods.every((p) => p.period_type === 'quarterly' && 'income' in p && !('balance' in p)));
    assert.equal((await request(app).get('/api/companies/TCS.NS/history?range=10Y')).status, 422);
    const h = await request(app).get('/api/companies/TCS.NS/history?range=1M');
    assert.ok(h.body.data.prices.length > 15 && h.body.data.prices.length < 25);
  });
});

describe('compare and screener', () => {
  test('compare validates 2-5 unique symbols', async () => {
    assert.equal((await request(app).post('/api/compare').send({ symbols: ['TCS.NS'] })).status, 422);
    assert.equal((await request(app).post('/api/compare').send({ symbols: ['TCS.NS', 'TCS.NS'] })).status, 422);
    assert.equal((await request(app).post('/api/compare').send({ symbols: ['A.NS', 'B.NS', 'C.NS', 'D.NS', 'E.NS', 'F.NS'] })).status, 422);
  });

  test('compare warns about mixed sectors', async () => {
    const res = await request(app).post('/api/compare').send({ symbols: ['TCS.NS', 'HDFCBANK.NS'] });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.companies.length, 2);
    assert.ok(res.body.data.warnings.some((w) => /different sectors/.test(w)));
  });

  test('screener runs over the universe (one listing per company)', async () => {
    const res = await request(app).post('/api/screener/run').send({ criteria: { filters: { roe: { min: 10 } } } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.universe_size, 23);
    assert.ok(res.body.data.results.every((r) => r.company.exchange === 'NSE'));
  });

  test('screener rejects invalid criteria', async () => {
    const res = await request(app).post('/api/screener/run').send({ criteria: { filters: { pe_ratio: { min: 50, max: 1 } } } });
    assert.equal(res.status, 422);
  });
});

describe('user data', () => {
  test('watchlist add / duplicate / list / ownership / remove', async () => {
    const alice = await registerAgent('alice@example.com');
    const bob = await registerAgent('bob@example.com');
    const added = await alice.post('/api/watchlist').set('Origin', ORIGIN).send({ symbol: 'infy.ns' });
    assert.equal(added.status, 201);
    assert.equal((await alice.post('/api/watchlist').send({ symbol: 'INFY.NS' })).status, 409);
    assert.equal((await alice.post('/api/watchlist').send({ symbol: 'NOPE.NS' })).status, 404);
    const list = await alice.get('/api/watchlist');
    assert.equal(list.body.data.items.length, 1);
    assert.ok(list.body.data.items[0].row.price > 0);
    assert.equal((await bob.get('/api/watchlist')).body.data.items.length, 0);
    assert.equal((await bob.delete(`/api/watchlist/${added.body.data.id}`)).status, 404, 'cannot delete another user\'s item');
    assert.equal((await alice.delete(`/api/watchlist/${added.body.data.id}`)).status, 204);
  });

  test('search history is recorded for logged-in users and can be cleared', async () => {
    const agent = await registerAgent('history@example.com');
    await agent.get('/api/companies/search?q=wipro');
    await new Promise((r) => setTimeout(r, 100)); // recording is fire-and-forget
    const list = await agent.get('/api/history');
    assert.equal(list.body.data.items[0].query, 'wipro');
    assert.equal(list.body.data.items[0].symbol, 'WIPRO.NS');
    const cleared = await agent.delete('/api/history');
    assert.equal(cleared.body.data.deleted, 1);
  });

  test('saved screens are validated in Node and forwarded to PHP with the session user id', async () => {
    const agent = await registerAgent('screens@example.com');
    const me = await agent.get('/api/auth/me');
    const bad = await agent.post('/api/saved-screens').send({ name: '', criteria: { filters: { nope: { min: 1 } } } });
    assert.equal(bad.status, 422);
    const forged = await agent.post('/api/saved-screens').send({ name: 'x', user_id: 1, criteria: {} });
    assert.equal(forged.status, 422, 'user_id in the body is rejected, never forwarded');
    const ok = await agent.post('/api/saved-screens').send({ name: 'Value', criteria: { filters: { pe_ratio: { max: 20 } } } });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.owner, String(me.body.data.id));
    const call = php.calls.at(-1);
    assert.equal(call.headers['x-internal-secret'], TEST_PHP_SECRET);
    assert.equal(call.headers['x-user-id'], String(me.body.data.id));
  });

  test('PHP errors are passed through; PHP outage becomes 503', async () => {
    const agent = await registerAgent('phpdown@example.com');
    assert.equal((await agent.delete('/api/saved-screens/404')).status, 404);
    assert.equal((await agent.delete('/api/saved-screens/abc')).status, 400);
    phpState.down = true;
    try {
      const res = await agent.get('/api/saved-screens');
      assert.equal(res.status, 502);
    } finally {
      phpState.down = false;
    }
    await php.close();
    const res = await agent.get('/api/research-notes');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'PERSISTENCE_SERVICE_UNAVAILABLE');
  });

  test('research note payloads are validated before reaching PHP', async () => {
    const agent = await registerAgent('notes@example.com');
    const res = await agent.post('/api/research-notes').send({ title: 'x'.repeat(151), content: '' });
    assert.equal(res.status, 422);
    assert.ok(res.body.error.details.title && res.body.error.details.content);
  });

  test('profile update and password change', async () => {
    const agent = await registerAgent('profile@example.com', 'Original1');
    const upd = await agent.put('/api/users/me').send({ name: 'New Name', preferred_unit: 'lakh' });
    assert.equal(upd.body.data.name, 'New Name');
    assert.equal(upd.body.data.preferred_unit, 'lakh');
    assert.equal((await agent.put('/api/users/me').send({ email: 'x@y.z' })).status, 422, 'email is not editable here');
    assert.equal((await agent.put('/api/users/me/password').send({ current_password: 'wrong', new_password: 'Another1' })).status, 422);
    assert.equal((await agent.put('/api/users/me/password').send({ current_password: 'Original1', new_password: 'Another1' })).status, 204);
    const login = await request(app).post('/api/auth/login').send({ email: 'profile@example.com', password: 'Another1' });
    assert.equal(login.status, 200);
  });
});

clearMemoryCache();
