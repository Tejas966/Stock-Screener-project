/**
 * MySQL-backed cache for provider data. Rows carry `source` and
 * `retrieved_at`, so freshness can be judged per data type and demo data is
 * never confused with provider data.
 */
import { getPool, query } from '../db/pool.js';

const STATEMENTS = ['income', 'balance', 'cashflow'];

// ---- quotes ---------------------------------------------------------------
export async function getQuote(companyId, source) {
  const rows = await query('SELECT * FROM quote_cache WHERE company_id = ? AND source = ?', [companyId, source]);
  const r = rows[0];
  if (!r) return null;
  return {
    quote: {
      price: r.price, currency: r.currency, change_pct: r.change_pct, shares_outstanding: r.shares_outstanding,
      market_cap: r.market_cap, dividend_per_share: r.dividend_per_share, observed_at: r.observed_at.toISOString(),
    },
    retrievedAt: r.retrieved_at,
  };
}

export async function saveQuote(companyId, source, q, retrievedAt) {
  await query(
    `INSERT INTO quote_cache (company_id, source, price, currency, change_pct, shares_outstanding, market_cap,
                              dividend_per_share, observed_at, retrieved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE price = VALUES(price), currency = VALUES(currency), change_pct = VALUES(change_pct),
       shares_outstanding = VALUES(shares_outstanding), market_cap = VALUES(market_cap),
       dividend_per_share = VALUES(dividend_per_share), observed_at = VALUES(observed_at), retrieved_at = VALUES(retrieved_at)`,
    [companyId, source, q.price, q.currency, q.change_pct ?? null, q.shares_outstanding != null ? Math.round(q.shares_outstanding) : null,
      q.market_cap ?? null, q.dividend_per_share ?? null, new Date(q.observed_at), retrievedAt],
  );
}

// ---- price history --------------------------------------------------------
export async function getHistory(companyId, source) {
  const rows = await query(
    'SELECT trade_date, close_price, volume, retrieved_at FROM price_history_cache WHERE company_id = ? AND source = ? ORDER BY trade_date',
    [companyId, source],
  );
  if (rows.length === 0) return null;
  return {
    prices: rows.map((r) => ({ date: r.trade_date.toISOString().slice(0, 10), close: r.close_price, volume: r.volume })),
    retrievedAt: rows.reduce((min, r) => (r.retrieved_at < min ? r.retrieved_at : min), rows[0].retrieved_at),
  };
}

export async function saveHistory(companyId, source, prices, retrievedAt) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM price_history_cache WHERE company_id = ? AND source = ?', [companyId, source]);
    for (let i = 0; i < prices.length; i += 500) {
      const chunk = prices.slice(i, i + 500);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const params = chunk.flatMap((p) => [companyId, source, p.date, p.close, p.volume ?? null, retrievedAt]);
      await conn.query(`INSERT INTO price_history_cache (company_id, source, trade_date, close_price, volume, retrieved_at) VALUES ${placeholders}`, params);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---- financial statements -------------------------------------------------
export async function getStatements(companyId, source) {
  const periods = await query(
    `SELECT id, period_type, fiscal_year, fiscal_period, period_end, currency, reported_at, retrieved_at
     FROM financial_periods WHERE company_id = ? AND source = ? ORDER BY period_end, period_type`,
    [companyId, source],
  );
  if (periods.length === 0) return null;
  const ids = periods.map((p) => p.id);
  const items = await query(
    `SELECT period_id, statement, item_key, value FROM financial_line_items WHERE period_id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  const byPeriod = new Map(periods.map((p) => [p.id, { income: null, balance: null, cashflow: null }]));
  for (const it of items) {
    const entry = byPeriod.get(it.period_id);
    entry[it.statement] ??= {};
    entry[it.statement][it.item_key] = it.value;
  }
  return {
    periods: periods.map((p) => ({
      fiscal_year: p.fiscal_year, fiscal_period: p.fiscal_period, period_type: p.period_type,
      period_end: p.period_end.toISOString().slice(0, 10), currency: p.currency,
      reported_at: p.reported_at ? p.reported_at.toISOString().slice(0, 10) : null,
      ...byPeriod.get(p.id),
    })),
    retrievedAt: periods.reduce((min, p) => (p.retrieved_at < min ? p.retrieved_at : min), periods[0].retrieved_at),
  };
}

export async function saveStatements(companyId, source, periods, retrievedAt) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM financial_periods WHERE company_id = ? AND source = ?', [companyId, source]);
    for (const p of periods) {
      const [r] = await conn.execute(
        `INSERT INTO financial_periods (company_id, source, period_type, fiscal_year, fiscal_period, period_end, currency, reported_at, retrieved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyId, source, p.period_type, p.fiscal_year, p.fiscal_period, p.period_end, p.currency, p.reported_at ?? null, retrievedAt],
      );
      const rows = [];
      for (const stmt of STATEMENTS) {
        for (const [key, value] of Object.entries(p[stmt] ?? {})) rows.push([r.insertId, stmt, key, value]);
      }
      if (rows.length) {
        await conn.query(`INSERT INTO financial_line_items (period_id, statement, item_key, value) VALUES ${rows.map(() => '(?, ?, ?, ?)').join(', ')}`, rows.flat());
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---- AI explanations ------------------------------------------------------
export async function getExplanation(companyId, inputHash, model) {
  const rows = await query('SELECT response_json, created_at FROM ai_explanations WHERE company_id = ? AND input_hash = ? AND model = ?', [companyId, inputHash, model]);
  if (!rows[0]) return null;
  const json = typeof rows[0].response_json === 'string' ? JSON.parse(rows[0].response_json) : rows[0].response_json;
  return { explanation: json, createdAt: rows[0].created_at };
}

export async function saveExplanation(companyId, inputHash, model, explanation) {
  await query(
    `INSERT INTO ai_explanations (company_id, input_hash, model, response_json) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE response_json = VALUES(response_json), created_at = CURRENT_TIMESTAMP`,
    [companyId, inputHash, model, JSON.stringify(explanation)],
  );
}
