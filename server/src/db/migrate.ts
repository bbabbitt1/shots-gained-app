import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrate = async () => {
  const pool = await getPool();
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pool.request().query(sql);
    console.log(`  ✓ ${file}`);
  }

  await closePool();
  console.log('Migrations complete.');
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
