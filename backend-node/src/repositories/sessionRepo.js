import { createHash, randomBytes } from 'node:crypto';
import { query } from '../db/pool.js';

const hash = (token) => createHash('sha256').update(token).digest('hex');

/** Creates a session and returns the raw token (only ever sent in the cookie). */
export async function createSession(userId, ttlHours) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + ttlHours * 3600 * 1000);
  await query('INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [userId, hash(token), expires]);
  return { token, expires };
}

export async function findUserIdByToken(token) {
  const rows = await query('SELECT user_id FROM user_sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()', [hash(token)]);
  return rows[0]?.user_id ?? null;
}

export async function deleteSession(token) {
  await query('DELETE FROM user_sessions WHERE token_hash = ?', [hash(token)]);
}

export async function deleteOtherSessions(userId, keepToken) {
  await query('DELETE FROM user_sessions WHERE user_id = ? AND token_hash <> ?', [userId, hash(keepToken)]);
}

export async function purgeExpired() {
  await query('DELETE FROM user_sessions WHERE expires_at <= UTC_TIMESTAMP()');
}
