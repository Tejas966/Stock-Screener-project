import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';
const gemini = await import('../src/services/geminiService.js');
const { closePool } = await import('../src/db/pool.js');

const valid = {
  executive_summary: 'Revenue grew 11.29% and the P/E ratio is 26.12 based on the supplied data.',
  positive_observations: ['Operating margin of 24.29% indicates efficient operations in the supplied period.'],
  risk_factors: ['Data is illustrative, so no real risk can be inferred.'],
  metric_explanations: [{ metric: 'P/E ratio', explanation: 'Price divided by earnings per share.' }],
  data_limitations: ['These are illustrative demo figures.'],
  overall_caveat: 'Not investment advice.',
};

const metric = (value, status = 'calculated') => ({ key: 'k', label: 'k', value, unit: 'ratio', status, reason: null, flags: [] });
const bundle = {
  company: { id: 999999, name: 'Test Co', symbol: 'TEST.NS', exchange: 'NSE', sector: { name: 'IT', slug: 'information-technology' }, industry: 'Software' },
  provider: { name: 'demo', label: 'Illustrative demo dataset', is_demo: true },
  quote: { price: 100, observed_at: '2025-06-30T10:00:00Z' },
  statements: { periods: [{ period_type: 'annual', fiscal_year: 2025, income: { revenue: 1e10, net_income: 1e9, eps: 3.83 }, cashflow: null }] },
  analysis: {
    currency: 'INR', latest_annual_period: { fiscal_year: 2025 },
    valuation: { pe_ratio: metric(26.1245), ev_ebitda: metric(null, 'not_meaningful') },
    latest: { profitability: { operating_margin: metric(24.2926) }, growth: { revenue_growth: metric(11.2929) }, health: {}, cashflow: {} },
    cagr: {}, warnings: [], quality: { completeness: { overall_pct: 95 }, checks: [] },
  },
};

const fakeClient = (impl) => ({ models: { generateContent: impl } });
let callCount = 0;

before(() => { callCount = 0; });
after(async () => { gemini.setGeminiClientForTests(null); await closePool(); });

test('not configured without an API key', async () => {
  gemini.setGeminiClientForTests(null);
  await assert.rejects(gemini.explain(bundle), { code: 'AI_NOT_CONFIGURED', status: 503 });
});

test('fact sheet contains only financial facts (no user data) and flags demo data', () => {
  const fs = gemini.buildFactSheet(bundle);
  assert.equal(fs.is_demo_data, true);
  assert.equal(fs.valuation.pe_ratio.value, 26.12);
  assert.equal(fs.valuation.ev_ebitda.status, 'not_meaningful');
  assert.ok(!JSON.stringify(fs).includes('@'), 'no email-like strings');
  assert.equal(fs.annual_history_in_crore[0].revenue, 1000);
});

test('valid structured response is accepted and sent with schema + system rules', async () => {
  let request;
  gemini.setGeminiClientForTests(fakeClient(async (req) => { request = req; callCount++; return { text: JSON.stringify(valid) }; }));
  const out = await gemini.explain(bundle);
  assert.equal(out.explanation.executive_summary, valid.executive_summary);
  assert.equal(request.config.responseMimeType, 'application/json');
  assert.ok(request.config.responseJsonSchema.required.includes('risk_factors'));
  assert.match(request.config.systemInstruction, /Never invent/);
  assert.ok(request.config.abortSignal instanceof AbortSignal);
  assert.deepEqual(out.ungrounded_numbers, []);
});

test('numbers not present in the fact sheet are flagged', async () => {
  const invented = { ...valid, executive_summary: 'The stock will rise to 4500 and revenue was 777.7 crore.' };
  gemini.setGeminiClientForTests(fakeClient(async () => ({ text: JSON.stringify(invented) })));
  const fs = gemini.buildFactSheet(bundle);
  const flagged = gemini.findUngroundedNumbers(invented, fs);
  assert.ok(flagged.includes('4500'));
  assert.ok(flagged.includes('777.7'));
});

test('malformed JSON is rejected', async () => {
  const b = { ...bundle, quote: { ...bundle.quote, price: 101 } }; // different hash -> no cache hit
  gemini.setGeminiClientForTests(fakeClient(async () => ({ text: '{"executive_summary": "oops"' })));
  await assert.rejects(gemini.explain(b), { code: 'AI_INVALID_RESPONSE' });
});

test('wrong structure (extra or missing fields, HTML-ish overlong text) is rejected', async () => {
  const b = { ...bundle, quote: { ...bundle.quote, price: 102 } };
  gemini.setGeminiClientForTests(fakeClient(async () => ({ text: JSON.stringify({ ...valid, buy_rating: 'BUY' }) })));
  await assert.rejects(gemini.explain(b), { code: 'AI_INVALID_RESPONSE' });
  gemini.setGeminiClientForTests(fakeClient(async () => ({ text: JSON.stringify({ executive_summary: 'x' }) })));
  await assert.rejects(gemini.explain(b), { code: 'AI_INVALID_RESPONSE' });
  gemini.setGeminiClientForTests(fakeClient(async () => ({ text: JSON.stringify({ ...valid, overall_caveat: 'x'.repeat(5000) }) })));
  await assert.rejects(gemini.explain(b), { code: 'AI_INVALID_RESPONSE' });
});

test('empty / blocked responses are reported', async () => {
  const b = { ...bundle, quote: { ...bundle.quote, price: 103 } };
  gemini.setGeminiClientForTests(fakeClient(async () => ({ text: undefined, promptFeedback: { blockReason: 'SAFETY' } })));
  await assert.rejects(gemini.explain(b), (e) => e.code === 'AI_NO_RESPONSE' && /SAFETY/.test(e.message));
});

test('quota exhaustion and timeouts map to friendly errors', async () => {
  const b = { ...bundle, quote: { ...bundle.quote, price: 104 } };
  gemini.setGeminiClientForTests(fakeClient(async () => { throw Object.assign(new Error('Resource exhausted'), { status: 429 }); }));
  await assert.rejects(gemini.explain(b), { code: 'AI_QUOTA_EXCEEDED' });
  gemini.setGeminiClientForTests(fakeClient(async () => { throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }); }));
  await assert.rejects(gemini.explain(b), { code: 'AI_TIMEOUT' });
});

test('explanation requires numerical analysis first', async () => {
  gemini.setGeminiClientForTests(fakeClient(async () => ({ text: JSON.stringify(valid) })));
  await assert.rejects(gemini.explain({ ...bundle, analysis: null }), { code: 'ANALYSIS_REQUIRED' });
});
