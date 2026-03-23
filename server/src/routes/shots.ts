import { Router } from 'express';
import mssql from 'mssql';
import { getPool } from '../db/connection.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { validate, batchShotsSchema } from '../middleware/validate.js';

const router = Router();

// Save all shots for a round (batch insert)
router.post('/batch', authenticate, validate(batchShotsSchema), async (req: AuthRequest, res) => {
  try {
    const { roundId, shots } = req.body;
    const pool = await getPool();

    // Verify round belongs to authenticated player
    const roundCheck = await pool.request()
      .input('roundId', roundId)
      .input('playerId', req.playerId)
      .query('SELECT 1 FROM DimRound WHERE RoundID = @roundId AND PlayerID = @playerId');
    if (roundCheck.recordset.length === 0) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      const table = new mssql.Table('FactShots');
      table.create = false;
      table.columns.add('PlayerID', mssql.Int, { nullable: false });
      table.columns.add('RoundID', mssql.Int, { nullable: false });
      table.columns.add('Hole', mssql.Int, { nullable: false });
      table.columns.add('Par', mssql.Int, { nullable: false });
      table.columns.add('HoleResult', mssql.NVarChar(20), { nullable: true });
      table.columns.add('Category', mssql.NVarChar(20), { nullable: false });
      table.columns.add('SurfaceStart', mssql.NVarChar(20), { nullable: false });
      table.columns.add('DistanceStart', mssql.Float, { nullable: false });
      table.columns.add('SurfaceEnd', mssql.NVarChar(20), { nullable: false });
      table.columns.add('DistanceEnd', mssql.Float, { nullable: false });
      table.columns.add('ClubUsed', mssql.NVarChar(50), { nullable: true });
      table.columns.add('ShotShape', mssql.NVarChar(50), { nullable: true });
      table.columns.add('Penalty', mssql.Bit, { nullable: false });
      table.columns.add('StrokesGained', mssql.Float, { nullable: false });
      table.columns.add('ShotResult', mssql.NVarChar(20), { nullable: true });
      table.columns.add('ShotDetails', mssql.NVarChar(mssql.MAX), { nullable: true });

      for (const s of shots) {
        table.rows.add(
          req.playerId, roundId, s.hole, s.par, s.holeResult || null,
          s.category, s.surfaceStart, s.distanceStart, s.surfaceEnd, s.distanceEnd,
          s.clubUsed || null, s.shotShape || null, s.penalty ? 1 : 0, s.strokesGained,
          s.shotResult || null,
          s.shotDetails ? JSON.stringify(s.shotDetails) : null
        );
      }

      await new mssql.Request(transaction).bulk(table);

      // Build and insert FactHoleScores rollup
      const holeMap = new Map<number, typeof shots>();
      for (const s of shots) {
        const arr = holeMap.get(s.hole) || [];
        arr.push(s);
        holeMap.set(s.hole, arr);
      }

      for (const [holeNum, holeShots] of holeMap) {
        const par = holeShots[0].par;
        const score = holeShots.reduce((n: number, s: typeof shots[0]) => n + 1 + (s.penalty ? 1 : 0), 0);
        const scoreToPar = score - par;
        const holeResult =
          scoreToPar <= -3 ? 'Albatross' :
          scoreToPar === -2 ? 'Eagle' :
          scoreToPar === -1 ? 'Birdie' :
          scoreToPar === 0 ? 'Par' :
          scoreToPar === 1 ? 'Bogey' :
          scoreToPar === 2 ? 'Double' :
          scoreToPar === 3 ? 'Triple' : 'Other';

        const teeShot = holeShots[0];
        const fairwayResult = par >= 4 ? (teeShot.shotResult || null) : null;

        // GIR: count cumulative strokes (including penalties) to check if green reached within par-2 strokes
        const girEligible = par - 2;
        let gir = false;
        let strokeCount = 0;
        for (const s of holeShots) {
          strokeCount += 1 + (s.penalty ? 1 : 0);
          if (strokeCount > girEligible) break;
          if (s.surfaceEnd === 'Green' || s.surfaceEnd === 'Hole') {
            gir = true;
            break;
          }
        }
        const putts = holeShots.filter((s: typeof shots[0]) => s.category === 'Putting').length;

        let upAndDown: boolean | null = null;
        if (!gir) {
          const sgIdx = holeShots.findIndex((s: typeof shots[0]) => s.category === 'Short Game');
          if (sgIdx >= 0) {
            const remaining = holeShots.slice(sgIdx);
            upAndDown = remaining.length <= 2 && remaining[remaining.length - 1].surfaceEnd === 'Hole';
          }
        }

        const sgByCategory = { Driving: 0, Approach: 0, 'Short Game': 0, Putting: 0 };
        for (const s of holeShots) {
          sgByCategory[s.category as keyof typeof sgByCategory] += s.strokesGained;
        }
        const sgTotal = holeShots.reduce((sum: number, s: typeof shots[0]) => sum + s.strokesGained, 0);

        await new mssql.Request(transaction)
          .input('roundId', roundId)
          .input('playerId', req.playerId)
          .input('hole', holeNum)
          .input('par', par)
          .input('score', score)
          .input('scoreToPar', scoreToPar)
          .input('holeResult', holeResult)
          .input('fairwayResult', fairwayResult)
          .input('gir', gir ? 1 : 0)
          .input('putts', putts)
          .input('upAndDown', upAndDown === null ? null : upAndDown ? 1 : 0)
          .input('sgTotal', sgTotal)
          .input('sgDriving', sgByCategory.Driving)
          .input('sgApproach', sgByCategory.Approach)
          .input('sgShortGame', sgByCategory['Short Game'])
          .input('sgPutting', sgByCategory.Putting)
          .query(`
            INSERT INTO FactHoleScores
              (RoundID, PlayerID, Hole, Par, Score, ScoreToPar, HoleResult, FairwayResult, GreenInReg, Putts, UpAndDown, SGTotal, SGDriving, SGApproach, SGShortGame, SGPutting)
            VALUES
              (@roundId, @playerId, @hole, @par, @score, @scoreToPar, @holeResult, @fairwayResult, @gir, @putts, @upAndDown, @sgTotal, @sgDriving, @sgApproach, @sgShortGame, @sgPutting)
          `);
      }

      await transaction.commit();
      res.json({ saved: shots.length, holes: holeMap.size });
    } catch (txErr) {
      try { await transaction.rollback(); } catch {}
      const txMsg = txErr instanceof Error ? txErr.message : String(txErr);
      const txStack = txErr instanceof Error ? txErr.stack : '';
      console.error('Transaction error:', txMsg, txStack);
      res.status(500).json({ error: 'Failed to save shots', detail: txMsg });
      return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Save shots error:', msg, err);
    res.status(500).json({ error: 'Failed to save shots', detail: msg });
  }
});

// Get shots for a round
router.get('/:roundId', authenticate, async (req: AuthRequest, res) => {
  try {
    const roundId = parseInt(req.params.roundId as string);
    if (isNaN(roundId)) { res.status(400).json({ error: 'Invalid roundId' }); return; }
    const pool = await getPool();
    const result = await pool.request()
      .input('roundId', roundId)
      .input('playerId', req.playerId)
      .query('SELECT * FROM FactShots WHERE RoundID = @roundId AND PlayerID = @playerId ORDER BY ShotID');

    res.json(result.recordset);
  } catch (err) {
    console.error('Get shots error:', err);
    res.status(500).json({ error: 'Failed to get shots' });
  }
});

export default router;
