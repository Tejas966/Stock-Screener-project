/**
 * The normalized internal financial-data model.
 *
 * Every provider adapter must return data in THIS shape. React and Python
 * never see provider-specific field names, units or sign conventions.
 *
 * Quote:
 *   { price, currency, change_pct, shares_outstanding (absolute count),
 *     market_cap (absolute, provider-reported or null), dividend_per_share,
 *     observed_at (ISO time the price refers to) }
 *
 * Period (one reporting period):
 *   { fiscal_year, fiscal_period ('FY' | 'Q1'..'Q4'), period_type ('annual'|'quarterly'),
 *     period_end 'YYYY-MM-DD', currency, reported_at,
 *     income:   { revenue, cost_of_revenue, gross_profit, operating_expenses, ebitda, depreciation,
 *                 operating_income, interest_expense, profit_before_tax, income_tax, net_income, eps },
 *     balance:  { cash_and_equivalents, current_assets, non_current_assets, total_assets,
 *                 current_liabilities, non_current_liabilities, total_liabilities, total_debt, total_equity },
 *     cashflow: { operating_cash_flow, investing_cash_flow, financing_cash_flow,
 *                 capital_expenditure, dividends_paid } }
 *
 * Conventions after normalization:
 *   - All amounts are ABSOLUTE units of `currency` (e.g. rupees, not crore).
 *   - capital_expenditure is a POSITIVE magnitude of cash spent.
 *   - interest_expense is a POSITIVE magnitude.
 *   - dividends_paid is NEGATIVE (cash outflow) as on a cash-flow statement.
 *   - null means "not reported". Missing values are NEVER replaced with 0.
 *   - eps stays per-share (not multiplied by the unit multiplier).
 */

export const STATEMENT_FIELDS = {
  income: ['revenue', 'cost_of_revenue', 'gross_profit', 'operating_expenses', 'ebitda', 'depreciation',
    'operating_income', 'interest_expense', 'profit_before_tax', 'income_tax', 'net_income', 'eps'],
  balance: ['cash_and_equivalents', 'current_assets', 'non_current_assets', 'total_assets', 'current_liabilities',
    'non_current_liabilities', 'total_liabilities', 'total_debt', 'total_equity'],
  cashflow: ['operating_cash_flow', 'investing_cash_flow', 'financing_cash_flow', 'capital_expenditure', 'dividends_paid'],
};

const PER_SHARE_FIELDS = new Set(['eps']);

/** Convert anything number-like to a finite number, else null. */
export function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize one statement object.
 * @param {object|null} raw     values keyed by the normalized field names
 * @param {'income'|'balance'|'cashflow'} statement
 * @param {number} multiplier   unit conversion factor (e.g. 1e7 for crore -> rupees)
 */
export function normalizeStatement(raw, statement, multiplier = 1) {
  if (!raw) return null;
  const out = {};
  for (const field of STATEMENT_FIELDS[statement]) {
    const v = num(raw[field]);
    out[field] = v === null ? null : PER_SHARE_FIELDS.has(field) ? v : v * multiplier;
  }
  if (statement === 'cashflow') {
    if (out.capital_expenditure !== null) out.capital_expenditure = Math.abs(out.capital_expenditure);
    if (out.dividends_paid !== null) out.dividends_paid = -Math.abs(out.dividends_paid);
  }
  if (statement === 'income' && out.interest_expense !== null) out.interest_expense = Math.abs(out.interest_expense);
  // A statement where nothing was reported is treated as absent.
  return Object.values(out).every((v) => v === null) ? null : out;
}

/** Indian companies mostly use an April-March fiscal year: FY2025 ends 31 Mar 2025. */
export function fiscalYearFromDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.getUTCMonth() <= 2 ? d.getUTCFullYear() : d.getUTCFullYear() + 1;
}

export function normalizePeriod(raw, { multiplier = 1, currency = 'INR' } = {}) {
  const periodType = raw.period_type === 'quarterly' ? 'quarterly' : 'annual';
  const end = String(raw.period_end).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  return {
    fiscal_year: Number.isInteger(raw.fiscal_year) ? raw.fiscal_year : fiscalYearFromDate(end),
    fiscal_period: raw.fiscal_period || (periodType === 'annual' ? 'FY' : 'Q?'),
    period_type: periodType,
    period_end: end,
    currency: String(raw.currency || currency).toUpperCase(),
    reported_at: raw.reported_at ?? null,
    income: normalizeStatement(raw.income, 'income', multiplier),
    balance: normalizeStatement(raw.balance, 'balance', multiplier),
    cashflow: normalizeStatement(raw.cashflow, 'cashflow', multiplier),
  };
}

/** Merge periods that refer to the same (type, end date), e.g. from separate statement endpoints. */
export function mergePeriods(periods) {
  const map = new Map();
  for (const p of periods.filter(Boolean)) {
    const key = `${p.period_type}:${p.period_end}`;
    const prev = map.get(key);
    map.set(key, prev ? {
      ...prev,
      income: prev.income ?? p.income, balance: prev.balance ?? p.balance, cashflow: prev.cashflow ?? p.cashflow,
      reported_at: prev.reported_at ?? p.reported_at,
    } : p);
  }
  return [...map.values()].sort((a, b) => a.period_end.localeCompare(b.period_end));
}
