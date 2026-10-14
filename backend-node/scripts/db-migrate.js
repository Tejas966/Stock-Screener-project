/**
 * Applies versioned SQL migrations from database/migrations in filename order
 * and records them in schema_migrations, so running it twice is safe.
 *
 *   npm run db:migrate            -> development database (DB_NAME)
 *   npm run db:migrate -- --reset -> DROP all tables first (development only!)
 *   NODE_ENV=test npm run db:migrate -> test database (DB_TEST_NAME)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
import { config } from '../src/config.js';

const reset = process.argv.includes('--reset');
const dir = join(config.rootDir, 'database', 'migrations');

export async function migrate({ resetFirst = false, log = console.log } = {}) {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
  try {
    if (resetFirst) {
      if (config.isProduction) throw new Error('Refusing to reset a production database');
      const [tables] = await conn.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?', [config.db.database]);
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const { t } of tables) await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      log(`Dropped ${tables.length} tables from ${config.db.database}`);
    }
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const [done] = await conn.query('SELECT version FROM schema_migrations');
    const applied = new Set(done.map((r) => r.version));
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      await conn.query(readFileSync(join(dir, file), 'utf8'));
      await conn.query('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
      log(`Applied ${file}`);
    }
    log(`Database ${config.db.database} is up to date (${files.length} migration file(s)).`);
  } finally {
    await conn.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('db-migrate.js')) {
  migrate({ resetFirst: reset }).catch((err) => {
    console.error(`Migration failed: ${err.message}`);
    process.exit(1);
  });
}
