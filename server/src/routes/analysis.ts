import { Router } from 'express';
import { getPool } from '../db/connection.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/analysis/shots?filter=last5|last10|all
router.get('/shots', authenticate, async (req: AuthRequest, res) => {
  try {
    const filter = (req.query.filter as string) || 'all';
    const pool = await getPool();

    // Get round IDs based on filter
    let roundFilter = '';
    if (filter.startsWith('round:')) {
      const roundId = parseInt(filter.split(':')[1]);
      if (!isNaN(roundId)) roundFilter = `AND fs.RoundID = ${roundId}`;
    } else if (filter === 'last5' || filter === 'last10') {
      const limit = filter === 'last5' ? 5 : 10;
      const roundsResult = await pool.request()
        .input('playerId', req.playerId)
        .input('limit', limit)
        .query(`
          SELECT TOP (@limit) RoundID
          FROM DimRound
          WHERE PlayerID = @playerId
          ORDER BY RoundDate DESC
        `);
      const ids = roundsResult.recordset.map((r: { RoundID: number }) => r.RoundID);
      if (ids.length === 0) { res.json({ shots: [], rounds: [] }); return; }
      roundFilter = `AND fs.RoundID IN (${ids.join(',')})`;
    }

    const result = await pool.request()
      .input('playerId', req.playerId)
      .query(`
        SELECT
          fs.ShotID, fs.RoundID, fs.Hole, fs.Par, fs.Category,
          fs.SurfaceStart, fs.DistanceStart, fs.SurfaceEnd, fs.DistanceEnd,
          fs.ClubUsed, fs.ShotResult, fs.Penalty, fs.StrokesGained,
          dr.RoundDate, dr.HolesPlayed, dc.ClubName
        FROM FactShots fs
        JOIN DimRound dr ON fs.RoundID = dr.RoundID
        JOIN DimCourse dc ON dr.CourseID = dc.CourseID
        WHERE fs.PlayerID = @playerId
          AND fs.Category IN ('Driving', 'Approach', 'Putting')
          ${roundFilter}
        ORDER BY dr.RoundDate DESC, fs.Hole, fs.ShotID
      `);

    // Also return round list for the filter dropdown
    const rounds = await pool.request()
      .input('playerId', req.playerId)
      .query(`
        SELECT dr.RoundID, dr.RoundDate, dr.HolesPlayed, dc.ClubName
        FROM DimRound dr
        JOIN DimCourse dc ON dr.CourseID = dc.CourseID
        WHERE dr.PlayerID = @playerId
        ORDER BY dr.RoundDate DESC
      `);

    res.json({ shots: result.recordset, rounds: rounds.recordset });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Analysis error:', msg);
    res.status(500).json({ error: 'Failed to load analysis data', detail: msg });
  }
});

export default router;
