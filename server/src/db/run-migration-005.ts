import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const run = async () => {
  const pool = await getPool();
  const sql = fs.readFileSync(path.join(__dirname, 'migrations/005_short_distance_benchmarks.sql'), 'utf-8');
  await pool.request().query(sql);
  console.log('Migration 005 applied: 57 benchmark rows inserted');
  await closePool();
};

run().catch(console.error);
