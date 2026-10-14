import { query } from '../db/pool.js';

const SELECT = `SELECT c.id, c.company_name, c.symbol, c.ticker, c.exchange, c.isin, c.industry, c.currency,
                       c.is_featured, s.sector_name, s.sector_slug
                FROM companies c LEFT JOIN sectors s ON s.id = c.sector_id`;

export const toCompany = (r) => ({
  id: r.id, name: r.company_name, symbol: r.symbol, ticker: r.ticker, exchange: r.exchange, isin: r.isin,
  industry: r.industry, currency: r.currency, featured: Boolean(r.is_featured),
  sector: r.sector_name ? { name: r.sector_name, slug: r.sector_slug } : null,
});

export async function findBySymbol(symbol) {
  const rows = await query(`${SELECT} WHERE c.symbol = ?`, [symbol]);
  return rows[0] ? toCompany(rows[0]) : null;
}

export async function findById(id) {
  const rows = await query(`${SELECT} WHERE c.id = ?`, [id]);
  return rows[0] ? toCompany(rows[0]) : null;
}

/**
 * Ranked search over the supported universe. Exact ticker matches rank first,
 * then name/ticker prefix matches, then substring matches.
 */
export async function search(q, limit = 20) {
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const prefix = `${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await query(
    `${SELECT}
     WHERE c.ticker = ? OR c.symbol = ? OR c.company_name LIKE ? OR c.ticker LIKE ? OR c.isin = ?
     ORDER BY (c.ticker = ? OR c.symbol = ?) DESC,
              (c.company_name LIKE ? OR c.ticker LIKE ?) DESC,
              c.exchange = 'NSE' DESC, c.company_name ASC
     LIMIT ${Number(limit)}`,
    [q, q, like, like, q, q, q, prefix, prefix],
  );
  return rows.map(toCompany);
}

/** All listings; `primaryOnly` keeps one listing per company (prefers NSE). */
export async function listAll({ primaryOnly = false } = {}) {
  const rows = await query(`${SELECT} ORDER BY c.company_name, c.exchange = 'NSE' DESC`);
  const companies = rows.map(toCompany);
  if (!primaryOnly) return companies;
  const seen = new Set();
  return companies.filter((c) => {
    const key = c.isin || c.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function listSectors() {
  return query(`SELECT s.id, s.sector_name AS name, s.sector_slug AS slug, s.description,
                       COUNT(DISTINCT COALESCE(c.isin, c.company_name)) AS company_count
                FROM sectors s LEFT JOIN companies c ON c.sector_id = s.id
                GROUP BY s.id ORDER BY s.sector_name`);
}

export async function findSectorBySlug(slug) {
  const rows = await query('SELECT id, sector_name AS name, sector_slug AS slug, description FROM sectors WHERE sector_slug = ?', [slug]);
  return rows[0] ?? null;
}
