import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const run = async () => {
  const pool = await getPool();
  const sql = fs.readFileSync(path.join(__dirname, 'migrations/006_indexes.sql'), 'utf-8');
  // Run each statement separately (CREATE INDEX can't be batched)
  for (const stmt of sql.split(';').filter((s) => s.trim())) {
    await pool.request().query(stmt);
  }
  console.log('Migration 006 applied: indexes created');
  await closePool();
};

run().catch(console.error);
