/**
 * Orchestrates: company identity (MySQL) -> market data (provider + cache)
 * -> Python calculations. Results keep provider-reported values, Python-
 * calculated metrics and their metadata clearly separated.
 */
import { createHash } from 'node:crypto';
import * as companyRepo from '../repositories/companyRepo.js';
import { ApiError, notFound } from '../utils/errors.js';
import { CRORE } from '../utils/format.js';
import { TtlCache } from '../utils/ttlCache.js';
import * as marketData from './marketDataService.js';
import { getProvider } from './providers/index.js';
import { python } from './pythonClient.js';

const analysisCache = new TtlCache(500);
const universeCache = new TtlCache(10);
const FINANCIAL_SECTORS = new Set(['banking']);

export const SYMBOL_RE = /^[A-Z0-9&-]{1,20}\.(NS|BO)$/;

export function parseSymbol(raw) {
  const symbol = String(raw ?? '').trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) throw new ApiError(400, 'INVALID_SYMBOL', 'Symbol must look like TCS.NS (NSE) or 532540.BO (BSE)');
  return symbol;
}

export async function getCompanyOr404(rawSymbol) {
  const company = await companyRepo.findBySymbol(parseSymbol(rawSymbol));
  if (!company) throw notFound('Company');
  return company;
}

/** Shape the Python AnalysisRequest. Must match backend-python/app/schemas.py exactly. */
export function buildAnalysisPayload(company, quote, periods) {
  const stripPeriod = ({ reported_at, ...p }) => p; // eslint-disable-line no-unused-vars
  return {
    symbol: company.symbol,
    sector: company.sector?.name ?? null,
    is_financial_sector: FINANCIAL_SECTORS.has(company.sector?.slug),
    market: {
      price: quote?.price ?? null,
      currency: quote?.currency ?? company.currency ?? 'INR',
      shares_outstanding: quote?.shares_outstanding ?? null,
      market_cap: quote?.market_cap ?? null,
      dividend_per_share: quote?.dividend_per_share ?? null,
    },
    periods: (periods ?? []).map(stripPeriod),
  };
}

const hashOf = (obj) => createHash('sha256').update(JSON.stringify(obj)).digest('hex');

async function runAnalysis(payload) {
  return analysisCache.wrap(`analysis:${hashOf(payload)}`, 600, () => python.analyze(payload));
}

function settledError(reason) {
  const e = reason instanceof ApiError ? reason : new ApiError(500, 'INTERNAL_ERROR', 'Unexpected error');
  if (!(reason instanceof ApiError)) console.error(reason);
  return { code: e.code, message: e.message };
}

/**
 * Everything the stock pages need. Partial failures are reported per part:
 * a quote failure does not hide statements, and an analysis failure does
 * not hide the raw numbers.
 */
export async function getCompanyBundle(rawSymbol) {
  const company = await getCompanyOr404(rawSymbol);
  const [quoteR, stmtR] = await Promise.allSettled([marketData.getQuote(company), marketData.getStatements(company)]);
  if (quoteR.status === 'rejected' && stmtR.status === 'rejected') {
    throw quoteR.reason instanceof ApiError ? quoteR.reason : new ApiError(502, 'PROVIDER_ERROR', 'Market data unavailable');
  }
  const quote = quoteR.status === 'fulfilled' ? quoteR.value : null;
  const statements = stmtR.status === 'fulfilled' ? stmtR.value : null;

  let analysis = null;
  let analysisError = null;
  try {
    analysis = await runAnalysis(buildAnalysisPayload(company, quote?.data, statements?.data));
  } catch (err) {
    analysisError = settledError(err);
  }

  return {
    company,
    provider: { name: getProvider().name, is_demo: getProvider().isDemo, label: getProvider().label },
    quote: quote ? { ...quote.data, meta: quote.meta } : null,
    quote_error: quoteR.status === 'rejected' ? settledError(quoteR.reason) : null,
    statements: statements ? { periods: statements.data, unit: 'absolute', currency: statements.data[0]?.currency ?? company.currency, meta: statements.meta } : null,
    statements_error: stmtR.status === 'rejected' ? settledError(stmtR.reason) : null,
    analysis,
    analysis_error: analysisError,
  };
}

/** Flat metric row used by screener, comparison, watchlist and sectors. */
export function metricRow(company, quote, analysis) {
  const km = analysis?.key_metrics ?? {};
  return {
    company,
    price: quote?.price ?? null,
    change_pct: quote?.change_pct ?? null,
    quote_observed_at: quote?.observed_at ?? null,
    latest_period: analysis?.latest_annual_period ?? null,
    metrics: { ...km, market_cap_cr: km.market_cap == null ? null : km.market_cap / CRORE },
    statuses: analysis ? collectStatuses(analysis) : {},
  };
}

function collectStatuses(analysis) {
  const out = {};
  const groups = [analysis.valuation, analysis.latest?.profitability, analysis.latest?.health, analysis.latest?.cashflow, analysis.latest?.growth];
  for (const g of groups) {
    for (const [k, m] of Object.entries(g ?? {})) out[k] = { status: m.status, reason: m.reason, flags: m.flags };
  }
  out.market_cap_cr = out.market_cap;
  return out;
}

/**
 * Metric rows for a list of companies (quote + statements + one batched
 * Python call). Companies whose data cannot be fetched are returned in
 * `unavailable`, never silently dropped.
 */
export async function getRowsForCompanies(companies) {
  const fetched = await Promise.all(companies.map(async (company) => {
    const [q, s] = await Promise.allSettled([marketData.getQuote(company), marketData.getStatements(company)]);
    return {
      company,
      quote: q.status === 'fulfilled' ? q.value : null,
      statements: s.status === 'fulfilled' ? s.value : null,
      error: q.status === 'rejected' && s.status === 'rejected' ? settledError(q.reason) : null,
    };
  }));
  const usable = fetched.filter((f) => !f.error);
  const results = usable.length ? await python.analyzeBatch(usable.map((f) => buildAnalysisPayload(f.company, f.quote?.data, f.statements?.data))) : [];
  return {
    rows: usable.map((f, i) => ({ ...metricRow(f.company, f.quote?.data, results[i]), data_meta: f.quote?.meta ?? f.statements?.meta })),
    unavailable: fetched.filter((f) => f.error).map((f) => ({ symbol: f.company.symbol, name: f.company.name, error: f.error })),
  };
}

/** Metric rows for the whole supported universe (one listing per company). */
export async function getUniverse() {
  const provider = getProvider();
  return universeCache.wrap(`universe:${provider.name}`, 300, async () => {
    const companies = await companyRepo.listAll({ primaryOnly: true });
    const { rows, unavailable } = await getRowsForCompanies(companies);
    return {
      rows,
      unavailable,
      provider: { name: provider.name, is_demo: provider.isDemo, label: provider.label },
      generated_at: new Date().toISOString(),
    };
  });
}

export function clearAnalysisCaches() {
  analysisCache.clear();
  universeCache.clear();
}
