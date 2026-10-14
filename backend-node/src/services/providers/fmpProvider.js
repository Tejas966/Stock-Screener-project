/**
 * Financial Modeling Prep (FMP) adapter - "stable" REST API.
 *   Docs: https://site.financialmodelingprep.com/developer/docs
 *   NSE symbols use the ".NS" suffix (RELIANCE.NS), BSE uses ".BO" (500325.BO).
 *
 * STATUS: implemented against FMP's documented field names, but NOT verified
 * against the live API from the development environment (outbound access to
 * FMP was blocked there, and no API key was available). Coverage of Indian
 * listings, statement depth and history length depends on your FMP plan;
 * check the plan before relying on it. Every response is shape-checked and
 * unknown/missing fields become null - nothing is invented.
 *
 * Endpoints used (all GET, `apikey` query parameter):
 *   /quote?symbol=                      latest (delayed) quote
 *   /profile?symbol=                    market cap, last dividend
 *   /income-statement?symbol=&period=annual|quarter&limit=
 *   /balance-sheet-statement?symbol=&period=annual&limit=
 *   /cash-flow-statement?symbol=&period=annual&limit=
 *   /historical-price-eod/light?symbol=&from=&to=
 */
import { z } from 'zod';
import { config } from '../../config.js';
import { ApiError } from '../../utils/errors.js';
import { fetchJson } from '../../utils/http.js';
import { fiscalYearFromDate, mergePeriods, normalizePeriod, num } from './normalize.js';

const rowArray = z.array(z.record(z.string(), z.unknown()));

async function call(path, params) {
  if (!config.provider.apiKey) {
    throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED', 'Financial data provider API key is not configured');
  }
  const qs = new URLSearchParams({ ...params, apikey: config.provider.apiKey });
  const { status, data } = await fetchJson(`${config.provider.baseUrl}${path}?${qs}`, {
    timeoutMs: config.provider.timeoutMs, upstream: 'Financial data provider',
  });
  if (status === 429) throw new ApiError(503, 'PROVIDER_RATE_LIMITED', 'Financial data provider rate limit reached; try again later');
  if (status === 401 || status === 403) throw new ApiError(503, 'PROVIDER_FORBIDDEN', 'Provider rejected the request (check API key or plan coverage)');
  if (status >= 400) throw new ApiError(502, 'PROVIDER_ERROR', `Financial data provider returned HTTP ${status}`);
  // FMP reports some errors as 200 + {"Error Message": "..."}.
  if (data && !Array.isArray(data) && (data['Error Message'] || data.error)) {
    throw new ApiError(502, 'PROVIDER_ERROR', 'Financial data provider returned an error');
  }
  const parsed = rowArray.safeParse(data);
  if (!parsed.success) throw new ApiError(502, 'PROVIDER_BAD_RESPONSE', 'Unexpected response format from financial data provider');
  return parsed.data;
}

const first = (...vals) => {
  for (const v of vals) {
    const n = num(v);
    if (n !== null) return n;
  }
  return null;
};

function periodBase(row, periodType) {
  const end = String(row.date ?? '').slice(0, 10);
  const fy = Number.parseInt(row.fiscalYear ?? row.calendarYear, 10);
  return {
    period_type: periodType,
    period_end: end,
    fiscal_year: Number.isInteger(fy) ? fy : (end ? fiscalYearFromDate(end) : undefined),
    fiscal_period: periodType === 'annual' ? 'FY' : String(row.period ?? 'Q?').slice(0, 4),
    currency: row.reportedCurrency || 'INR',
    reported_at: row.filingDate ? String(row.filingDate).slice(0, 10) : null,
  };
}

// FMP field names -> normalized model. FMP reports absolute currency units, so multiplier = 1.
export const mapIncome = (r) => ({
  revenue: first(r.revenue), cost_of_revenue: first(r.costOfRevenue), gross_profit: first(r.grossProfit),
  operating_expenses: first(r.operatingExpenses), ebitda: first(r.ebitda), depreciation: first(r.depreciationAndAmortization),
  operating_income: first(r.operatingIncome, r.ebit), interest_expense: first(r.interestExpense),
  profit_before_tax: first(r.incomeBeforeTax), income_tax: first(r.incomeTaxExpense), net_income: first(r.netIncome),
  eps: first(r.epsDiluted, r.epsdiluted, r.eps),
});

export const mapBalance = (r) => ({
  cash_and_equivalents: first(r.cashAndCashEquivalents), current_assets: first(r.totalCurrentAssets),
  non_current_assets: first(r.totalNonCurrentAssets), total_assets: first(r.totalAssets),
  current_liabilities: first(r.totalCurrentLiabilities), non_current_liabilities: first(r.totalNonCurrentLiabilities),
  total_liabilities: first(r.totalLiabilities), total_debt: first(r.totalDebt),
  total_equity: first(r.totalStockholdersEquity, r.totalEquity),
});

export const mapCashflow = (r) => ({
  operating_cash_flow: first(r.operatingCashFlow, r.netCashProvidedByOperatingActivities),
  investing_cash_flow: first(r.netCashProvidedByInvestingActivities, r.netCashUsedForInvestingActivites),
  financing_cash_flow: first(r.netCashProvidedByFinancingActivities, r.netCashUsedProvidedByFinancingActivities),
  capital_expenditure: first(r.capitalExpenditure), // FMP: negative outflow -> normalized to magnitude
  dividends_paid: first(r.netDividendsPaid, r.dividendsPaid, r.commonDividendsPaid),
});

export const fmpProvider = {
  name: 'fmp',
  isDemo: false,
  label: 'Financial Modeling Prep (delayed / end-of-day data)',

  async getQuote(company) {
    const [quoteRows, profileRows] = await Promise.all([
      call('/quote', { symbol: company.symbol }),
      call('/profile', { symbol: company.symbol }).catch(() => []),
    ]);
    const q = quoteRows[0];
    const price = num(q?.price);
    if (!q || price === null || price <= 0) throw new ApiError(404, 'NO_PROVIDER_DATA', `Provider has no quote for ${company.symbol}`);
    const p = profileRows[0] ?? {};
    const marketCap = first(q.marketCap, p.marketCap);
    const ts = num(q.timestamp);
    return {
      price,
      currency: String(p.currency || 'INR').toUpperCase(),
      change_pct: first(q.changePercentage, q.changesPercentage),
      // FMP's quote has no share count; derive it from cap/price only when both exist.
      shares_outstanding: first(q.sharesOutstanding) ?? (marketCap ? marketCap / price : null),
      market_cap: marketCap,
      dividend_per_share: first(p.lastDividend, p.lastDiv),
      observed_at: ts ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
    };
  },

  async getStatements(company, { years = 5 } = {}) {
    const sym = company.symbol;
    const [inc, bal, cf, incQ] = await Promise.all([
      call('/income-statement', { symbol: sym, period: 'annual', limit: String(years) }),
      call('/balance-sheet-statement', { symbol: sym, period: 'annual', limit: String(years) }),
      call('/cash-flow-statement', { symbol: sym, period: 'annual', limit: String(years) }),
      call('/income-statement', { symbol: sym, period: 'quarter', limit: '4' }).catch(() => []), // often plan-restricted
    ]);
    const periods = [
      ...inc.map((r) => normalizePeriod({ ...periodBase(r, 'annual'), income: mapIncome(r) })),
      ...bal.map((r) => normalizePeriod({ ...periodBase(r, 'annual'), balance: mapBalance(r) })),
      ...cf.map((r) => normalizePeriod({ ...periodBase(r, 'annual'), cashflow: mapCashflow(r) })),
      ...incQ.map((r) => normalizePeriod({ ...periodBase(r, 'quarterly'), income: mapIncome(r) })),
    ];
    return mergePeriods(periods);
  },

  async getHistory(company, { years = 5 } = {}) {
    const to = new Date();
    const from = new Date(to);
    from.setUTCFullYear(from.getUTCFullYear() - years);
    const rows = await call('/historical-price-eod/light', {
      symbol: company.symbol, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10),
    });
    return rows
      .map((r) => ({ date: String(r.date ?? '').slice(0, 10), close: first(r.close, r.price), volume: first(r.volume) }))
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.close !== null && r.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async getIndices() {
    const out = [];
    for (const [symbol, name] of [['^NSEI', 'NIFTY 50'], ['^BSESN', 'BSE SENSEX']]) {
      try {
        const history = await this.getHistory({ symbol }, { years: 1 });
        if (history.length) out.push({ symbol, name, history });
      } catch {
        // index coverage depends on the plan; omit rather than fabricate
      }
    }
    return out;
  },
};
