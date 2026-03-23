import { Router } from 'express';
import { getPool } from '../db/connection.js';

const router = Router();

// Get all benchmark data (loaded once by client)
router.get('/', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT Surface as surface, Distance as distance, TourAvg as tourAvg FROM DimAvg ORDER BY Surface, Distance');

    res.json(result.recordset);
  } catch (err) {
    console.error('Get benchmarks error:', err);
    res.status(500).json({ error: 'Failed to get benchmarks' });
  }
});

export default router;
