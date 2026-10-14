/**
 * DEMO provider - serves the version-controlled ILLUSTRATIVE dataset in
 * data/demo-dataset.json. Every response is tagged `is_demo: true` and the UI
 * shows a demo banner. Nothing here is real market or financial data.
 *
 * Price history is generated deterministically (seeded random walk) so that
 * charts are reproducible; it is labelled as illustrative everywhere.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../../utils/errors.js';
import { CRORE } from '../../utils/format.js';
import { mergePeriods, normalizePeriod } from './normalize.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data');
const dataset = JSON.parse(readFileSync(join(dataDir, 'demo-dataset.json'), 'utf8'));
const aliases = JSON.parse(readFileSync(join(dataDir, 'demo-listing-aliases.json'), 'utf8'));

export const DEMO_AS_OF = dataset.as_of; // all demo "prices" are end-of-day on this date

function recordFor(company) {
  const key = aliases[company.ticker] ?? company.ticker;
  const rec = dataset.companies[key];
  if (!rec) throw new ApiError(404, 'NO_PROVIDER_DATA', `No demo data for ${company.symbol}`);
  return rec;
}

function prng(seedText) {
  let seed = 0;
  for (const ch of seedText) seed = (Math.imul(31, seed) + ch.charCodeAt(0)) | 0;
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller standard normal from a uniform PRNG. */
const gaussian = (rnd) => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());

const historyCache = new Map();

/** ~5 years of weekday closes ending on DEMO_AS_OF, scaled so the last close = illustrative price. */
export function generateHistory(ticker, endPrice, volatility, endDate = DEMO_AS_OF, years = 5) {
  const cacheKey = `${ticker}:${endDate}`;
  if (historyCache.has(cacheKey)) return historyCache.get(cacheKey);
  const rnd = prng(`${ticker}-history`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  const dates = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) dates.push(d.toISOString().slice(0, 10));
  }
  const dt = 1 / 252;
  const drift = 0.11;
  let level = 1;
  const raw = dates.map(() => {
    level *= Math.exp((drift - 0.5 * volatility ** 2) * dt + volatility * Math.sqrt(dt) * gaussian(rnd));
    return level;
  });
  const scale = endPrice / raw[raw.length - 1];
  const prices = dates.map((date, i) => ({
    date,
    close: Math.round(raw[i] * scale * 100) / 100,
    volume: Math.round(200000 + rnd() * 3000000),
  }));
  historyCache.set(cacheKey, prices);
  return prices;
}

export const demoProvider = {
  name: 'demo',
  isDemo: true,
  label: 'Illustrative demo dataset (not real market data)',

  async getQuote(company) {
    const rec = recordFor(company);
    const history = generateHistory(rec.ticker, rec.illustrative_price, rec.price_volatility);
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    return {
      price: last.close,
      currency: 'INR',
      change_pct: Math.round(((last.close / prev.close) - 1) * 10000) / 100,
      shares_outstanding: Math.round(rec.shares_outstanding_crore * CRORE), // whole shares (matches BIGINT cache column)
      market_cap: null,
      dividend_per_share: rec.dividend_per_share,
      observed_at: `${DEMO_AS_OF}T10:00:00.000Z`, // 15:30 IST close
    };
  },

  async getStatements(company) {
    const rec = recordFor(company);
    const raw = [
      ...rec.statements.annual.map((p) => ({ ...p, period_type: 'annual' })),
      ...rec.statements.quarterly.map((p) => ({ ...p, period_type: 'quarterly' })),
    ];
    // Dataset is stored in crore (Indian reporting convention) -> convert to rupees.
    return mergePeriods(raw.map((p) => normalizePeriod(p, { multiplier: CRORE, currency: 'INR' })));
  },

  async getHistory(company) {
    const rec = recordFor(company);
    return generateHistory(rec.ticker, rec.illustrative_price, rec.price_volatility);
  },

  /** Illustrative index levels for the market page (clearly labelled). */
  async getIndices() {
    return [
      { symbol: 'NIFTY50-DEMO', name: 'NIFTY 50 (illustrative)', history: generateHistory('NIFTY50', 24500, 0.14) },
      { symbol: 'SENSEX-DEMO', name: 'BSE SENSEX (illustrative)', history: generateHistory('SENSEX', 80500, 0.14) },
    ];
  },
};
