import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const run = async () => {
  const pool = await getPool();
  const sql = fs.readFileSync(path.join(__dirname, 'migrations/007_update_clubs.sql'), 'utf-8');
  for (const stmt of sql.split(';').filter((s) => s.trim())) {
    const result = await pool.request().query(stmt);
    console.log(`Rows affected: ${result.rowsAffected}`);
  }
  console.log('Migration 007 applied: updated club names (50° → 52°, 58° → 60°)');
  await closePool();
};

run().catch(console.error);
