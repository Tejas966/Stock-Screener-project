import { query } from '../db/pool.js';

const PUBLIC_COLUMNS = 'id, name, email, preferred_period, preferred_unit, created_at, updated_at';

export async function findByEmail(email) {
  const rows = await query('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
  return rows[0] ?? null;
}

export async function findById(id) {
  const rows = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

export async function findPasswordHash(id) {
  const rows = await query('SELECT password_hash FROM users WHERE id = ?', [id]);
  return rows[0]?.password_hash ?? null;
}

export async function create({ name, email, passwordHash }) {
  const result = await query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, passwordHash]);
  return result.insertId;
}

/** Update only whitelisted profile columns. */
export async function updateProfile(id, changes) {
  const allowed = ['name', 'preferred_period', 'preferred_unit'];
  const keys = Object.keys(changes).filter((k) => allowed.includes(k));
  if (keys.length === 0) return;
  await query(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => changes[k]), id]);
}

export async function updatePassword(id, passwordHash) {
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}
