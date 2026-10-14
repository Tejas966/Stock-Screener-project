/**
 * Market-data access with layered caching:
 *   1. in-process memory (fast, short-lived)
 *   2. MySQL cache tables (survive restarts, also a fallback during outages)
 *   3. the configured provider
 * Each data type has its own TTL (quotes change faster than annual reports).
 * When the provider fails and only an expired copy exists, that copy is
 * returned with cache_status "stale" - never silently replaced with fake data.
 */
import { config } from '../config.js';
import * as cacheRepo from '../repositories/marketCacheRepo.js';
import { TtlCache } from '../utils/ttlCache.js';
import { getProvider } from './providers/index.js';

const memory = new TtlCache(1000);

// Cache writes replace a company's rows inside a transaction (DELETE + INSERT).
// Running many of them concurrently (e.g. the screener loading every company)
// makes InnoDB gap locks deadlock, so writes are applied one at a time.
let writeQueue = Promise.resolve();
function enqueueWrite(task) {
  const run = writeQueue.then(task);
  writeQueue = run.catch(() => {});
  return run;
}
const log = (msg) => { if (!config.isTest) console.warn(`[market-data] ${msg}`); };

function meta(provider, status, retrievedAt, extra = {}) {
  return {
    source: provider.name,
    source_label: provider.label,
    is_demo: provider.isDemo,
    cache_status: status, // fresh = fetched now, cached = from cache within TTL, stale = expired cache after provider failure
    retrieved_at: new Date(retrievedAt).toISOString(),
    delayed: true, // no provider used here is real-time
    ...extra,
  };
}

async function layered({ type, company, ttl, readDb, writeDb, fetchFresh }) {
  const provider = getProvider();
  const key = `${provider.name}:${type}:${company.symbol}`;
  const hit = memory.get(key);
  if (hit) return { ...hit, meta: { ...hit.meta, cache_status: 'cached' } };

  let dbCopy = null;
  try {
    dbCopy = await readDb(company.id, provider.name);
  } catch (err) {
    log(`cache read failed for ${type} (${err.code || err.message}); continuing without DB cache`);
  }
  const ageSeconds = dbCopy ? (Date.now() - new Date(dbCopy.retrievedAt).getTime()) / 1000 : Infinity;
  if (dbCopy && ageSeconds < ttl) {
    const result = { data: dbCopy.value, meta: meta(provider, 'cached', dbCopy.retrievedAt) };
    memory.set(key, result, Math.max(1, Math.min(ttl - ageSeconds, 300)));
    return result;
  }

  try {
    const value = await fetchFresh(provider);
    const now = new Date();
    try {
      await enqueueWrite(() => writeDb(company.id, provider.name, value, now));
    } catch (err) {
      log(`cache write failed for ${type} (${err.code || err.message})`);
    }
    const result = { data: value, meta: meta(provider, 'fresh', now) };
    memory.set(key, result, Math.min(ttl, 300));
    return result;
  } catch (err) {
    if (dbCopy) {
      log(`provider failed for ${type} ${company.symbol}; serving stale cache`);
      return { data: dbCopy.value, meta: meta(provider, 'stale', dbCopy.retrievedAt, { warning: 'Provider unavailable - showing the last cached copy' }) };
    }
    throw err;
  }
}

export function getQuote(company) {
  return layered({
    type: 'quote', company, ttl: config.cacheTtl.quote,
    readDb: async (id, src) => { const r = await cacheRepo.getQuote(id, src); return r && { value: r.quote, retrievedAt: r.retrievedAt }; },
    writeDb: (id, src, v, at) => cacheRepo.saveQuote(id, src, v, at),
    fetchFresh: (p) => p.getQuote(company),
  });
}

export function getStatements(company) {
  return layered({
    type: 'statements', company, ttl: config.cacheTtl.statements,
    readDb: async (id, src) => { const r = await cacheRepo.getStatements(id, src); return r && { value: r.periods, retrievedAt: r.retrievedAt }; },
    writeDb: (id, src, v, at) => cacheRepo.saveStatements(id, src, v, at),
    fetchFresh: (p) => p.getStatements(company),
  });
}

export function getHistory(company) {
  return layered({
    type: 'history', company, ttl: config.cacheTtl.history,
    readDb: async (id, src) => { const r = await cacheRepo.getHistory(id, src); return r && { value: r.prices, retrievedAt: r.retrievedAt }; },
    writeDb: (id, src, v, at) => cacheRepo.saveHistory(id, src, v, at),
    fetchFresh: (p) => p.getHistory(company),
  });
}

export async function getIndices() {
  const provider = getProvider();
  const indices = await memory.wrap(`${provider.name}:indices`, config.cacheTtl.history, () => provider.getIndices());
  return { indices, meta: meta(provider, 'fresh', new Date()) };
}

export function clearMemoryCache() {
  memory.clear();
}
