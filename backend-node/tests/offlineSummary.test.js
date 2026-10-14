import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
const { buildOfflineSummary } = await import('../src/services/offlineSummary.js');
const { explanationSchema } = await import('../src/services/geminiService.js');
const { SNAPSHOT_PATH } = await import('../src/services/offlineSnapshot.js');

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
const metric = (value, status = 'calculated', extra = {}) => ({ key: 'k', label: 'Metric', value, unit: 'percent', status, reason: null, flags: [], ...extra });

test('every saved summary satisfies the explanation contract and never recommends', () => {
  for (const [symbol, entry] of Object.entries(snapshot.companies)) {
    assert.ok(explanationSchema.safeParse(entry.summary).success, symbol);
    const text = JSON.stringify({ ...entry.summary, overall_caveat: '' }).toLowerCase();
    assert.ok(!/\b(buy|sell|hold|target price|will rise|will fall)\b/.test(text), `${symbol} contains advice-like wording`);
  }
});

test('demo data is always disclosed', () => {
  for (const entry of Object.values(snapshot.companies)) {
    assert.match(entry.summary.data_limitations[0], /illustrative demo figures/);
  }
});

test('bank summary does not apply industrial liquidity/leverage judgements', () => {
  const s = snapshot.companies['HDFCBANK.NS'].summary;
  const text = JSON.stringify(s);
  assert.ok(!/Current ratio|Debt-to-equity of/.test(text));
  assert.match(s.executive_summary, /As a bank/);
});

test('loss years and missing data are reported, not hidden', () => {
  assert.ok(snapshot.companies['M&M.NS'].summary.risk_factors.some((r) => /net loss in FY21/.test(r)));
  assert.ok(snapshot.companies['NESTLEIND.NS'].summary.positive_observations.some((r) => /4 years with data/.test(r)));
});

test('peer comparisons are skipped without enough peers', () => {
  const bundle = {
    company: { name: 'Solo Ltd', symbol: 'SOLO.NS', sector: { name: 'Niche', slug: 'niche' } },
    provider: { is_demo: false },
    statements: { periods: [] },
    analysis: {
      latest_annual_period: { fiscal_year: 2025 },
      valuation: { pe_ratio: metric(20, 'calculated', { unit: 'multiple' }) },
      latest: { profitability: { roe: metric(30) }, health: {}, growth: {}, cashflow: {} },
      series: [], cagr: {}, quality: { checks: [] },
    },
  };
  const s = buildOfflineSummary(bundle, { roe: { count: 2, median: 10 }, pe_ratio: { count: 2, median: 10 } });
  assert.ok(!JSON.stringify(s).includes('median'));
  assert.ok(!s.data_limitations.some((d) => /illustrative/.test(d)), 'live data is not called demo');
});

test('works with almost no data', () => {
  const s = buildOfflineSummary({
    company: { name: 'Empty Ltd', symbol: 'EMPTY.NS', sector: null },
    provider: { is_demo: true },
    statements: null,
    analysis: { latest_annual_period: null, valuation: { pe_ratio: metric(null, 'not_meaningful', { reason: 'EPS is zero or negative' }) }, latest: null, series: [], cagr: {}, quality: null },
  });
  assert.match(s.executive_summary, /not meaningful because eps is zero or negative/);
  assert.deepEqual(s.positive_observations, []);
});
