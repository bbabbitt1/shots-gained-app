import { Router } from 'express';
import { getPool } from '../db/connection.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { validate, createRoundSchema } from '../middleware/validate.js';

const router = Router();

// Create a new round
router.post('/', authenticate, validate(createRoundSchema), async (req: AuthRequest, res) => {
  try {
    const { courseId, roundDate, holesPlayed, teePreference, benchmark } = req.body;
    const pool = await getPool();

    const result = await pool.request()
      .input('playerId', req.playerId)
      .input('courseId', courseId)
      .input('roundDate', roundDate)
      .input('holesPlayed', holesPlayed)
      .input('tee', teePreference)
      .input('benchmark', benchmark || 'Pro')
      .query(`
        INSERT INTO DimRound (PlayerID, CourseID, RoundDate, HolesPlayed, TeePreference, Benchmark)
        OUTPUT INSERTED.RoundID
        VALUES (@playerId, @courseId, @roundDate, @holesPlayed, @tee, @benchmark)
      `);

    res.json({ roundId: result.recordset[0].RoundID });
  } catch (err) {
    console.error('Create round error:', err);
    res.status(500).json({ error: 'Failed to create round' });
  }
});

// Get player's rounds
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('playerId', req.playerId)
      .query(`
        SELECT r.*, c.ClubName, c.CourseName
        FROM DimRound r
        LEFT JOIN DimCourse c ON r.CourseID = c.CourseID
        WHERE r.PlayerID = @playerId
        ORDER BY r.RoundDate DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Get rounds error:', err);
    res.status(500).json({ error: 'Failed to get rounds' });
  }
});

// Get player dashboard stats
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const pool = await getPool();

    // Aggregate stats from FactHoleScores
    const stats = await pool.request()
      .input('playerId', req.playerId)
      .query(`
        SELECT
          COUNT(DISTINCT hs.RoundID) AS rounds,
          COUNT(*) AS holes,
          SUM(hs.Score) AS totalStrokes,
          SUM(hs.Par) AS totalPar,
          ROUND(AVG(CAST(hs.SGTotal AS FLOAT)), 2) AS avgSGPerHole,
          ROUND(SUM(hs.SGDriving), 2) AS sgDriving,
          ROUND(SUM(hs.SGApproach), 2) AS sgApproach,
          ROUND(SUM(hs.SGShortGame), 2) AS sgShortGame,
          ROUND(SUM(hs.SGPutting), 2) AS sgPutting,
          SUM(CASE WHEN hs.GreenInReg = 1 THEN 1 ELSE 0 END) AS girHit,
          SUM(CASE WHEN hs.Par >= 4 AND hs.FairwayResult IS NOT NULL THEN 1 ELSE 0 END) AS firTotal,
          SUM(CASE WHEN hs.FairwayResult IN ('Hit Fairway', 'Drive Green') THEN 1 ELSE 0 END) AS firHit,
          SUM(CASE WHEN hs.UpAndDown IS NOT NULL THEN 1 ELSE 0 END) AS udTotal,
          SUM(CASE WHEN hs.UpAndDown = 1 THEN 1 ELSE 0 END) AS udHit,
          SUM(hs.Putts) AS totalPutts
        FROM FactHoleScores hs
        WHERE hs.PlayerID = @playerId
      `);

    // Recent rounds (last 5)
    const recent = await pool.request()
      .input('playerId', req.playerId)
      .query(`
        SELECT TOP 5 r.RoundID, r.RoundDate, r.HolesPlayed, r.TeePreference,
          c.ClubName, c.CourseName,
          SUM(hs.Score) AS totalScore, SUM(hs.Par) AS totalPar,
          ROUND(SUM(hs.SGTotal), 2) AS totalSG
        FROM DimRound r
        LEFT JOIN DimCourse c ON r.CourseID = c.CourseID
        LEFT JOIN FactHoleScores hs ON r.RoundID = hs.RoundID
        WHERE r.PlayerID = @playerId
        GROUP BY r.RoundID, r.RoundDate, r.HolesPlayed, r.TeePreference, c.ClubName, c.CourseName
        ORDER BY r.RoundDate DESC
      `);

    res.json({ stats: stats.recordset[0], recentRounds: recent.recordset });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get hole scores for a round
router.get('/:roundId/scores', authenticate, async (req: AuthRequest, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('roundId', parseInt(req.params.roundId as string))
      .input('playerId', req.playerId)
      .query(`
        SELECT * FROM FactHoleScores
        WHERE RoundID = @roundId AND PlayerID = @playerId
        ORDER BY Hole
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Get hole scores error:', err);
    res.status(500).json({ error: 'Failed to get hole scores' });
  }
});

export default router;
