import { getPool, closePool } from './connection.js';

const run = async () => {
  const pool = await getPool();
  const r = await pool.request().query(
    'SELECT Surface, MIN(Distance) as MinDist, MAX(Distance) as MaxDist, COUNT(*) as Rows FROM DimAvg GROUP BY Surface ORDER BY Surface'
  );
  for (const row of r.recordset) {
    console.log(`${row.Surface}: ${row.MinDist}-${row.MaxDist} yds (${row.Rows} rows)`);
  }

  // Spot check: Fairway at 4 yards
  const check = await pool.request().query(
    "SELECT Surface, Distance, TourAvg FROM DimAvg WHERE Surface = 'Fairway' AND Distance <= 5 ORDER BY Distance"
  );
  console.log('\nFairway 1-5 yds:');
  for (const row of check.recordset) {
    console.log(`  ${row.Distance}yd = ${row.TourAvg}`);
  }

  await closePool();
};

run().catch(console.error);
