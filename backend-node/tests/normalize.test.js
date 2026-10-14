import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapBalance, mapCashflow, mapIncome } from '../src/services/providers/fmpProvider.js';
import { fiscalYearFromDate, mergePeriods, normalizePeriod, normalizeStatement } from '../src/services/providers/normalize.js';

test('crore amounts are converted to rupees but EPS is not', () => {
  const s = normalizeStatement({ revenue: 100, net_income: 12.5, eps: 34.2 }, 'income', 1e7);
  assert.equal(s.revenue, 1e9);
  assert.equal(s.net_income, 1.25e8);
  assert.equal(s.eps, 34.2);
});

test('missing values stay null and are never turned into zero', () => {
  const s = normalizeStatement({ revenue: 100, gross_profit: null, ebitda: undefined, depreciation: '' }, 'income');
  assert.equal(s.gross_profit, null);
  assert.equal(s.ebitda, null);
  assert.equal(s.depreciation, null);
  assert.equal(s.operating_income, null);
});

test('non-numeric junk becomes null', () => {
  const s = normalizeStatement({ revenue: 'N/A', net_income: Infinity }, 'income');
  assert.equal(s, null, 'a statement with no usable values is treated as absent');
});

test('capex is normalized to a positive magnitude, dividends to negative', () => {
  const s = normalizeStatement({ operating_cash_flow: 50, capital_expenditure: -20, dividends_paid: 5 }, 'cashflow');
  assert.equal(s.capital_expenditure, 20);
  assert.equal(s.dividends_paid, -5);
  assert.equal(normalizeStatement({ capital_expenditure: 20 }, 'cashflow').capital_expenditure, 20);
});

test('interest expense is normalized to a magnitude', () => {
  assert.equal(normalizeStatement({ interest_expense: -30 }, 'income').interest_expense, 30);
});

test('Indian fiscal year derivation', () => {
  assert.equal(fiscalYearFromDate('2025-03-31'), 2025);
  assert.equal(fiscalYearFromDate('2024-06-30'), 2025);
  assert.equal(fiscalYearFromDate('2024-12-31'), 2025);
});

test('normalizePeriod rejects invalid dates and uppercases currency', () => {
  assert.equal(normalizePeriod({ period_end: 'yesterday' }), null);
  const p = normalizePeriod({ period_end: '2025-03-31', currency: 'inr', income: { revenue: 1 } });
  assert.equal(p.currency, 'INR');
  assert.equal(p.fiscal_year, 2025);
  assert.equal(p.period_type, 'annual');
});

test('mergePeriods combines statements from separate endpoints for the same period', () => {
  const a = normalizePeriod({ period_end: '2025-03-31', income: { revenue: 10 } });
  const b = normalizePeriod({ period_end: '2025-03-31', balance: { total_assets: 99 } });
  const c = normalizePeriod({ period_end: '2024-03-31', income: { revenue: 8 } });
  const merged = mergePeriods([a, b, c]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].period_end, '2024-03-31');
  assert.equal(merged[1].income.revenue, 10);
  assert.equal(merged[1].balance.total_assets, 99);
});

test('FMP field mapping covers documented names and alternates', () => {
  const inc = mapIncome({ revenue: 1000, costOfRevenue: 600, operatingIncome: 200, interestExpense: 20, netIncome: 100, epsDiluted: 5, incomeBeforeTax: 180 });
  assert.equal(inc.revenue, 1000);
  assert.equal(inc.profit_before_tax, 180);
  assert.equal(inc.eps, 5);
  assert.equal(inc.ebitda, null);
  const bal = mapBalance({ totalAssets: 500, totalEquity: 200, totalDebt: 50 });
  assert.equal(bal.total_equity, 200);
  const cf = mapCashflow({ netCashProvidedByOperatingActivities: 70, capitalExpenditure: -30 });
  assert.equal(cf.operating_cash_flow, 70);
  assert.equal(normalizeStatement(cf, 'cashflow').capital_expenditure, 30);
});
