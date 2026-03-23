import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = async () => {
  const pool = await getPool();

  // Check if already seeded
  const count = await pool.request().query('SELECT COUNT(*) as cnt FROM DimAvg');
  if (count.recordset[0].cnt > 0) {
    console.log(`DimAvg already has ${count.recordset[0].cnt} rows. Skipping seed.`);
    await closePool();
    return;
  }

  const csvPath = path.join(__dirname, '../../../data/dimaverages.csv');
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.trim().split('\n').slice(1); // skip header

  console.log(`Seeding ${lines.length} benchmark rows...`);

  // Batch insert in chunks of 500
  const chunkSize = 500;
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    const values = chunk
      .map((line) => {
        const [surface, distance, tourAvg, unit] = line.split(',').map((s) => s.trim());
        return `('${surface}', ${distance}, ${tourAvg}, '${unit || 'Yds'}')`;
      })
      .join(',\n');

    await pool.request().query(
      `INSERT INTO DimAvg (Surface, Distance, TourAvg, UnitOfMeasurement) VALUES ${values}`
    );
    console.log(`  ✓ Inserted rows ${i + 1}-${Math.min(i + chunkSize, lines.length)}`);
  }

  await closePool();
  console.log('Seed complete.');
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
