import { query } from '../db/pool.js';

export async function listForUser(userId) {
  return query(
    `SELECT w.id, w.added_at, c.id AS company_id, c.symbol
     FROM watchlist_items w JOIN companies c ON c.id = w.company_id
     WHERE w.user_id = ? ORDER BY w.added_at DESC, w.id DESC`,
    [userId],
  );
}

/** Returns the new item id, or null if the company is already in the watchlist. */
export async function add(userId, companyId) {
  try {
    const r = await query('INSERT INTO watchlist_items (user_id, company_id) VALUES (?, ?)', [userId, companyId]);
    return r.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return null;
    throw err;
  }
}

export async function remove(userId, itemId) {
  const r = await query('DELETE FROM watchlist_items WHERE id = ? AND user_id = ?', [itemId, userId]);
  return r.affectedRows > 0;
}

export async function count(userId) {
  const rows = await query('SELECT COUNT(*) AS n FROM watchlist_items WHERE user_id = ?', [userId]);
  return rows[0].n;
}
