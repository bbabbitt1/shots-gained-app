import { Router } from 'express';
import mssql from 'mssql';
import { getPool } from '../db/connection.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { validate, batchShotsSchema, updateShotSchema } from '../middleware/validate.js';

const router = Router();

// Recalculate FactHoleScores for a specific hole after shot edit/delete
const recalcHoleScores = async (transaction: mssql.Transaction, roundId: number, playerId: number, holeNum: number) => {
  // Get all remaining shots for this hole
  const shotsResult = await new mssql.Request(transaction)
    .input('roundId', roundId)
    .input('playerId', playerId)
    .input('hole', holeNum)
    .query('SELECT * FROM FactShots WHERE RoundID = @roundId AND PlayerID = @playerId AND Hole = @hole ORDER BY ShotID');

  const holeShots = shotsResult.recordset;

  // Delete existing hole score
  await new mssql.Request(transaction)
    .input('roundId', roundId)
    .input('hole', holeNum)
    .query('DELETE FROM FactHoleScores WHERE RoundID = @roundId AND Hole = @hole');

  // If no shots remain, we're done
  if (holeShots.length === 0) return;

  const par = holeShots[0].Par;
  const score = holeShots.reduce((n: number, s: any) => n + 1 + (s.Penalty ? 1 : 0), 0);
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
  const fairwayResult = par >= 4 ? (teeShot.ShotResult || null) : null;

  const girEligible = par - 2;
  let gir = false;
  let strokeCount = 0;
  for (const s of holeShots) {
    strokeCount += 1 + (s.Penalty ? 1 : 0);
    if (strokeCount > girEligible) break;
    if (s.SurfaceEnd === 'Green' || s.SurfaceEnd === 'Hole') { gir = true; break; }
  }

  const putts = holeShots.filter((s: any) => s.Category === 'Putting').length;

  let upAndDown: boolean | null = null;
  if (!gir) {
    const sgIdx = holeShots.findIndex((s: any) => s.Category === 'Short Game');
    if (sgIdx >= 0) {
      const remaining = holeShots.slice(sgIdx);
      upAndDown = remaining.length <= 2 && remaining[remaining.length - 1].SurfaceEnd === 'Hole';
    }
  }

  const sgByCategory = { Driving: 0, Approach: 0, 'Short Game': 0, Putting: 0 };
  for (const s of holeShots) {
    sgByCategory[s.Category as keyof typeof sgByCategory] += s.StrokesGained;
  }
  const sgTotal = holeShots.reduce((sum: number, s: any) => sum + s.StrokesGained, 0);

  await new mssql.Request(transaction)
    .input('roundId', roundId)
    .input('playerId', playerId)
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
};

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
      // Delete existing shots for these holes to allow re-saving
      const holes = [...new Set(shots.map((s: typeof shots[0]) => s.hole))];
      await new mssql.Request(transaction)
        .input('roundId', roundId)
        .query(`DELETE FROM FactShots WHERE RoundID = @roundId AND Hole IN (${holes.map(Number).join(',')})`);

      for (const s of shots) {
        await new mssql.Request(transaction)
          .input('playerId', req.playerId)
          .input('roundId', roundId)
          .input('hole', s.hole)
          .input('par', s.par)
          .input('holeResult', s.holeResult || null)
          .input('category', s.category)
          .input('surfaceStart', s.surfaceStart)
          .input('distanceStart', s.distanceStart)
          .input('surfaceEnd', s.surfaceEnd)
          .input('distanceEnd', s.distanceEnd)
          .input('clubUsed', s.clubUsed || null)
          .input('shotShape', s.shotShape || null)
          .input('penalty', s.penalty ? 1 : 0)
          .input('strokesGained', s.strokesGained)
          .input('shotResult', s.shotResult || null)
          .input('shotDetails', s.shotDetails ? JSON.stringify(s.shotDetails) : null)
          .query(`
            INSERT INTO FactShots (PlayerID, RoundID, Hole, Par, HoleResult, Category, SurfaceStart, DistanceStart, SurfaceEnd, DistanceEnd, ClubUsed, ShotShape, Penalty, StrokesGained, ShotResult, ShotDetails)
            VALUES (@playerId, @roundId, @hole, @par, @holeResult, @category, @surfaceStart, @distanceStart, @surfaceEnd, @distanceEnd, @clubUsed, @shotShape, @penalty, @strokesGained, @shotResult, @shotDetails)
          `);
      }

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
            MERGE FactHoleScores AS target
            USING (SELECT @roundId AS RoundID, @hole AS Hole) AS source
            ON target.RoundID = source.RoundID AND target.Hole = source.Hole
            WHEN MATCHED THEN UPDATE SET
              PlayerID = @playerId, Par = @par, Score = @score, ScoreToPar = @scoreToPar,
              HoleResult = @holeResult, FairwayResult = @fairwayResult, GreenInReg = @gir,
              Putts = @putts, UpAndDown = @upAndDown, SGTotal = @sgTotal,
              SGDriving = @sgDriving, SGApproach = @sgApproach, SGShortGame = @sgShortGame, SGPutting = @sgPutting
            WHEN NOT MATCHED THEN INSERT
              (RoundID, PlayerID, Hole, Par, Score, ScoreToPar, HoleResult, FairwayResult, GreenInReg, Putts, UpAndDown, SGTotal, SGDriving, SGApproach, SGShortGame, SGPutting)
            VALUES
              (@roundId, @playerId, @hole, @par, @score, @scoreToPar, @holeResult, @fairwayResult, @gir, @putts, @upAndDown, @sgTotal, @sgDriving, @sgApproach, @sgShortGame, @sgPutting);
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

// Update a shot
router.put('/:shotId', authenticate, validate(updateShotSchema), async (req: AuthRequest, res) => {
  try {
    const shotId = parseInt(req.params.shotId as string);
    if (isNaN(shotId)) { res.status(400).json({ error: 'Invalid shotId' }); return; }

    const pool = await getPool();

    // Get existing shot + verify ownership
    const existing = await pool.request()
      .input('shotId', shotId)
      .input('playerId', req.playerId)
      .query('SELECT * FROM FactShots WHERE ShotID = @shotId AND PlayerID = @playerId');
    if (existing.recordset.length === 0) { res.status(404).json({ error: 'Shot not found' }); return; }

    const shot = existing.recordset[0];
    const updates = req.body;

    // Build dynamic SET clause from provided fields
    const fieldMap: Record<string, string> = {
      hole: 'Hole', par: 'Par', holeResult: 'HoleResult', category: 'Category',
      surfaceStart: 'SurfaceStart', distanceStart: 'DistanceStart',
      surfaceEnd: 'SurfaceEnd', distanceEnd: 'DistanceEnd',
      clubUsed: 'ClubUsed', shotShape: 'ShotShape', shotResult: 'ShotResult',
      penalty: 'Penalty', strokesGained: 'StrokesGained',
    };

    const setClauses: string[] = [];
    const params: Array<{ key: string; val: unknown }> = [];

    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if (updates[jsKey] !== undefined) {
        const val = jsKey === 'penalty' ? (updates[jsKey] ? 1 : 0) : updates[jsKey];
        setClauses.push(`${dbCol} = @${jsKey}`);
        params.push({ key: jsKey, val });
      }
    }

    if (updates.shotDetails !== undefined) {
      setClauses.push('ShotDetails = @shotDetails');
      params.push({ key: 'shotDetails', val: JSON.stringify(updates.shotDetails) });
    }

    if (setClauses.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    const transaction = new mssql.Transaction(pool);
    await transaction.begin();
    try {
      const updateReq = new mssql.Request(transaction);
      updateReq.input('shotId', shotId);
      for (const p of params) updateReq.input(p.key, p.val);
      await updateReq.query(`UPDATE FactShots SET ${setClauses.join(', ')} WHERE ShotID = @shotId`);

      // Recalculate hole scores for the affected hole(s)
      const affectedHoles = new Set<number>();
      affectedHoles.add(shot.Hole);
      if (updates.hole !== undefined && updates.hole !== shot.Hole) affectedHoles.add(updates.hole);

      for (const h of affectedHoles) {
        await recalcHoleScores(transaction, shot.RoundID, req.playerId!, h);
      }

      await transaction.commit();
      res.json({ updated: true });
    } catch (txErr) {
      try { await transaction.rollback(); } catch {}
      throw txErr;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Update shot error:', msg);
    res.status(500).json({ error: 'Failed to update shot', detail: msg });
  }
});

// Delete a shot
router.delete('/:shotId', authenticate, async (req: AuthRequest, res) => {
  try {
    const shotId = parseInt(req.params.shotId as string);
    if (isNaN(shotId)) { res.status(400).json({ error: 'Invalid shotId' }); return; }

    const pool = await getPool();

    // Get existing shot + verify ownership
    const existing = await pool.request()
      .input('shotId', shotId)
      .input('playerId', req.playerId)
      .query('SELECT * FROM FactShots WHERE ShotID = @shotId AND PlayerID = @playerId');
    if (existing.recordset.length === 0) { res.status(404).json({ error: 'Shot not found' }); return; }

    const shot = existing.recordset[0];

    const transaction = new mssql.Transaction(pool);
    await transaction.begin();
    try {
      await new mssql.Request(transaction)
        .input('shotId', shotId)
        .query('DELETE FROM FactShots WHERE ShotID = @shotId');

      await recalcHoleScores(transaction, shot.RoundID, req.playerId!, shot.Hole);

      await transaction.commit();
      res.json({ deleted: true });
    } catch (txErr) {
      try { await transaction.rollback(); } catch {}
      throw txErr;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Delete shot error:', msg);
    res.status(500).json({ error: 'Failed to delete shot', detail: msg });
  }
});

export default router;
