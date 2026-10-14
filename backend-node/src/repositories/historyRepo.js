import { query } from '../db/pool.js';

const MAX_PER_USER = 200;

export async function record(userId, q, resolvedCompanyId = null) {
  await query('INSERT INTO search_history (user_id, query, resolved_company_id) VALUES (?, ?, ?)', [userId, q.slice(0, 100), resolvedCompanyId]);
  // Keep the table bounded: drop entries beyond the newest MAX_PER_USER.
  await query(
    `DELETE FROM search_history WHERE user_id = ? AND id NOT IN (
       SELECT id FROM (SELECT id FROM search_history WHERE user_id = ? ORDER BY id DESC LIMIT ${MAX_PER_USER}) keep)`,
    [userId, userId],
  );
}

export async function listForUser(userId, limit = 50) {
  return query(
    `SELECT h.id, h.query, h.searched_at, c.symbol, c.company_name, c.exchange
     FROM search_history h LEFT JOIN companies c ON c.id = h.resolved_company_id
     WHERE h.user_id = ? ORDER BY h.id DESC LIMIT ${Number(limit)}`,
    [userId],
  );
}

export async function clear(userId) {
  const r = await query('DELETE FROM search_history WHERE user_id = ?', [userId]);
  return r.affectedRows;
}

export async function removeOne(userId, id) {
  const r = await query('DELETE FROM search_history WHERE id = ? AND user_id = ?', [id, userId]);
  return r.affectedRows > 0;
}
