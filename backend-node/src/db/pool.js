import mysql from 'mysql2/promise';
import { config } from '../config.js';

let pool = null;

/** Lazily-created shared connection pool. All queries use placeholders (?). */
export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...config.db,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 5000,
      dateStrings: false,
      timezone: 'Z',
      decimalNumbers: true, // DECIMAL columns come back as JS numbers
      supportBigNumbers: true,
    });
    // Store and read TIMESTAMP columns in UTC regardless of the MySQL server's
    // own time zone (Windows installs often default to local time).
    pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));
  }
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
