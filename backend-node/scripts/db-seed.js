/**
 * Seeds the company universe and a clearly-labelled DEVELOPMENT demo account.
 *   npm run db:seed
 * Demo login (development only - never use in production):
 *   email: demo@fundamentalx.local   password: DemoPass123!
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { config } from '../src/config.js';

export async function seed({ log = console.log, demoUser = true } = {}) {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
  try {
    const dir = join(config.rootDir, 'database', 'seeds');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      await conn.query(readFileSync(join(dir, file), 'utf8'));
      log(`Seeded ${file}`);
    }
    if (demoUser && !config.isProduction) {
      const hash = await bcrypt.hash('DemoPass123!', 12);
      await conn.execute(
        `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        ['Demo Student', 'demo@fundamentalx.local', hash],
      );
      log('Demo account ready: demo@fundamentalx.local / DemoPass123! (development only)');
    }
  } finally {
    await conn.end();
  }
}

if (process.argv[1]?.endsWith('db-seed.js')) {
  seed().catch((err) => {
    console.error(`Seeding failed: ${err.message}`);
    process.exit(1);
  });
}
