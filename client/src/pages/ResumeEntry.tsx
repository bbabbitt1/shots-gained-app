import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SGTracker from '../components/SGTracker';
import ShotForm from '../components/ShotForm';
import { getBenchmarks, getShots, getRound, getCourseDetails, saveShots, updateShot, deleteShot } from '../services/api';
import { cacheBenchmarks, getCachedBenchmarks } from '../services/offline';
import { useRound } from '../hooks/useRound';
import { formatSG, calculateStrokesGained } from '@shared/sg-calculator';
import type { Shot, BenchmarkRow, CourseHole, Surface } from '@shared/types';
import { SURFACES, END_SURFACES } from '@shared/types';

interface DBShot {
  ShotID: number;
  Hole: number;
  Par: number;
  Category: string;
  SurfaceStart: string;
  DistanceStart: number;
  SurfaceEnd: string;
  DistanceEnd: number;
  ClubUsed: string | null;
  ShotResult: string | null;
  ShotShape: string | null;
  ShotDetails: string | null;
  Penalty: boolean;
  StrokesGained: number;
  HoleResult: string | null;
}

const ResumeEntry = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const round = useRound();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [existingShots, setExistingShots] = useState<Shot[]>([]);
  const [roundIdNum, setRoundIdNum] = useState(0);

  const [editingShotId, setEditingShotId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ surfaceStart: '', distanceStart: 0, surfaceEnd: '', distanceEnd: 0, penalty: false });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Map ShotID to existingShots index for quick lookup
  const [shotIdMap, setShotIdMap] = useState<Map<number, number>>(new Map());

  const player = JSON.parse(localStorage.getItem('player') || '{}');

  // Load round data, existing shots, course holes, benchmarks
  useEffect(() => {
    const rid = parseInt(roundId || '0');
    if (!rid) { navigate('/rounds'); return; }
    setRoundIdNum(rid);

    const load = async () => {
      try {
        const [roundMeta, dbShots, benchData] = await Promise.all([
          getRound(rid),
          getShots(rid),
          getBenchmarks().catch(async () => await getCachedBenchmarks() || []),
        ]);

        // Load course holes
        const courseDetails = await getCourseDetails(`${roundMeta.CourseID}` + '?source=cache');
        const tees = courseDetails?.course?.tees?.male || [];
        const selectedTee = tees.find((t: any) => t.tee_name === roundMeta.TeePreference) || tees[0];
        const courseHoles: CourseHole[] = selectedTee?.holes?.map((h: any, i: number) => ({
          holeNumber: i + 1,
          par: h.par,
          yardage: h.yardage,
          tee: roundMeta.TeePreference,
        })) || [];

        // Set up round state
        round.setCourse(
          { courseId: roundMeta.CourseID, clubName: roundMeta.ClubName, courseName: roundMeta.CourseName },
          roundMeta.TeePreference,
          courseHoles,
          roundMeta.HolesPlayed
        );
        round.setState((s) => ({ ...s, roundDate: roundMeta.RoundDate }));

        if (Array.isArray(benchData)) {
          round.setBenchmarks(benchData);
          cacheBenchmarks(benchData);
        }

        // Convert DB shots to client Shot format and track them
        const converted: Shot[] = (dbShots as DBShot[]).map((s) => ({
          playerId: player.playerId,
          hole: s.Hole,
          par: s.Par,
          category: s.Category as Shot['category'],
          surfaceStart: s.SurfaceStart as Shot['surfaceStart'],
          distanceStart: s.DistanceStart,
          surfaceEnd: s.SurfaceEnd as Shot['surfaceEnd'],
          distanceEnd: s.DistanceEnd,
          clubUsed: s.ClubUsed || undefined,
          shotResult: s.ShotResult || undefined,
          shotShape: s.ShotShape || undefined,
          penalty: !!s.Penalty,
          strokesGained: s.StrokesGained,
          holeResult: (s.HoleResult || undefined) as Shot['holeResult'],
        }));

        setExistingShots(converted);

        // Build ShotID map: index in existingShots → ShotID
        const idMap = new Map<number, number>();
        (dbShots as DBShot[]).forEach((s, i) => idMap.set(i, s.ShotID));
        setShotIdMap(idMap);

        // Find the next hole to play
        const completedHoles = new Set<number>();
        for (const s of converted) {
          if (s.surfaceEnd === 'Hole') completedHoles.add(s.hole);
        }

        // Find first incomplete or unplayed hole
        let startHole = roundMeta.HolesPlayed; // default to last hole
        for (let h = 1; h <= roundMeta.HolesPlayed; h++) {
          if (!completedHoles.has(h)) {
            startHole = h;
            break;
          }
        }

        const holeInfo = courseHoles.find((h) => h.holeNumber === startHole);
        round.setCurrentHole(startHole, holeInfo?.par || 4);

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load round');
        setLoading(false);
      }
    };
    load();
  }, [roundId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Combine existing + new shots for display
  const allShots = useMemo(() => [...existingShots, ...round.state.shots], [existingShots, round.state.shots]);

  const currentHoleInfo = useMemo(() => {
    const hole = round.state.holes.find((h) => h.holeNumber === round.state.currentHole);
    return hole || { holeNumber: round.state.currentHole, par: 4, yardage: 0 };
  }, [round.state.holes, round.state.currentHole]);

  // Shots on current hole = existing + new
  const currentHoleAllShots = useMemo(
    () => allShots.filter((s) => s.hole === round.state.currentHole),
    [allShots, round.state.currentHole]
  );

  const currentHoleNewShots = round.currentHoleShots;
  const previousShot = currentHoleAllShots.length > 0 ? currentHoleAllShots[currentHoleAllShots.length - 1] : null;
  const shotNumber = currentHoleAllShots.length + 1;

  const handleAddShot = (shot: Shot) => {
    round.addShot({ ...shot, hole: round.state.currentHole, par: currentHoleInfo.par });
  };

  const handleNextHole = () => {
    if (round.state.currentHole < round.state.holesPlayed) {
      const nextHole = round.state.currentHole + 1;
      const nextInfo = round.state.holes.find((h) => h.holeNumber === nextHole);
      round.setCurrentHole(nextHole, nextInfo?.par || 4);
    }
  };

  const handlePrevHole = () => {
    if (round.state.currentHole > 1) {
      const prevHole = round.state.currentHole - 1;
      const prevInfo = round.state.holes.find((h) => h.holeNumber === prevHole);
      round.setCurrentHole(prevHole, prevInfo?.par || 4);
    }
  };

  const startEdit = (shot: Shot, existingIdx: number) => {
    const shotId = shotIdMap.get(existingIdx);
    if (!shotId) return;
    setEditingShotId(shotId);
    setEditForm({
      surfaceStart: shot.surfaceStart,
      distanceStart: shot.distanceStart,
      surfaceEnd: shot.surfaceEnd,
      distanceEnd: shot.distanceEnd,
      penalty: shot.penalty,
    });
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingShotId || !round.state.benchmarks.length) return;
    setActionLoading(true);
    try {
      const sg = calculateStrokesGained(round.state.benchmarks, {
        surfaceStart: editForm.surfaceStart as Surface,
        distanceStart: editForm.distanceStart,
        surfaceEnd: editForm.surfaceEnd as Surface | 'Hole',
        distanceEnd: editForm.distanceEnd,
        penalty: editForm.penalty,
      });
      await updateShot(editingShotId, { ...editForm, strokesGained: sg });

      // Update local state
      const idx = [...shotIdMap.entries()].find(([, id]) => id === editingShotId)?.[0];
      if (idx !== undefined) {
        setExistingShots(prev => prev.map((s, i) => i === idx ? {
          ...s,
          surfaceStart: editForm.surfaceStart as Shot['surfaceStart'],
          distanceStart: editForm.distanceStart,
          surfaceEnd: editForm.surfaceEnd as Shot['surfaceEnd'],
          distanceEnd: editForm.distanceEnd,
          penalty: editForm.penalty,
          strokesGained: sg,
        } : s));
      }
      setEditingShotId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update shot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (existingIdx: number) => {
    const shotId = shotIdMap.get(existingIdx);
    if (!shotId) return;
    setActionLoading(true);
    try {
      await deleteShot(shotId);
      setExistingShots(prev => prev.filter((_, i) => i !== existingIdx));
      // Rebuild shotIdMap
      setShotIdMap(prev => {
        const newMap = new Map<number, number>();
        let newIdx = 0;
        for (let i = 0; i < existingShots.length; i++) {
          if (i === existingIdx) continue;
          const oldId = prev.get(i);
          if (oldId !== undefined) newMap.set(newIdx, oldId);
          newIdx++;
        }
        return newMap;
      });
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete shot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinish = async () => {
    if (round.state.shots.length === 0) {
      navigate(`/rounds/${roundIdNum}`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await saveShots(roundIdNum, round.state.shots);
      navigate(`/rounds/${roundIdNum}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  // SG tracker uses all shots (existing + new)
  const sgByCategory = useMemo(() => {
    const result = { Driving: 0, Approach: 0, 'Short Game': 0, Putting: 0 } as Record<string, number>;
    for (const s of allShots) result[s.category] = (result[s.category] || 0) + s.strokesGained;
    for (const k of Object.keys(result)) result[k] = Math.round(result[k] * 1000) / 1000;
    return result as any;
  }, [allShots]);

  const totalSG = useMemo(
    () => Math.round(allShots.reduce((sum, s) => sum + s.strokesGained, 0) * 1000) / 1000,
    [allShots]
  );

  // Live score
  const liveScore = useMemo(() => {
    const holes = new Map<number, { par: number; shots: number }>();
    for (const s of allShots) {
      const h = holes.get(s.hole) || { par: s.par, shots: 0 };
      h.shots += 1;
      if (s.penalty) h.shots += 1;
      holes.set(s.hole, h);
    }
    let totalStrokes = 0, totalPar = 0, holesCompleted = 0;
    for (const [holeNum, data] of holes) {
      const holeShots = allShots.filter((s) => s.hole === holeNum);
      if (holeShots[holeShots.length - 1]?.surfaceEnd === 'Hole') {
        totalStrokes += data.shots;
        totalPar += data.par;
        holesCompleted++;
      }
    }
    return { totalStrokes, totalPar, scoreToPar: totalStrokes - totalPar, holesCompleted };
  }, [allShots]);

  const scoreDisplay = liveScore.holesCompleted === 0 ? 'E'
    : liveScore.scoreToPar === 0 ? 'E'
    : liveScore.scoreToPar > 0 ? `+${liveScore.scoreToPar}` : `${liveScore.scoreToPar}`;

  const scoreColor = liveScore.scoreToPar < 0 ? 'text-sg-positive' : liveScore.scoreToPar > 0 ? 'text-sg-negative' : 'text-text-primary';

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center"><p className="text-text-secondary">Loading round...</p></div>;
  }

  if (error && round.state.shots.length === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center flex-col gap-3">
        <p className="text-sg-negative text-sm">{error}</p>
        <button onClick={() => navigate(`/rounds/${roundIdNum}`)} className="text-accent hover:underline text-sm py-2 min-h-[44px]">Back to round</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-4 pt-4 pb-8 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(`/rounds/${roundIdNum}`)} className="text-text-secondary text-sm py-2 min-h-[44px] hover:text-text-primary">
          ← Back
        </button>
        <span className="text-accent text-xs font-medium bg-accent/10 px-2 py-1 rounded">Resuming</span>
      </div>

      {/* SG Tracker */}
      <SGTracker sgByCategory={sgByCategory} totalSG={totalSG} shots={allShots} />

      {/* Score + Hole Navigation */}
      <div className="bg-bg-card border border-border rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-center gap-3">
          <span className={`text-2xl font-bold ${scoreColor}`}>{scoreDisplay}</span>
          {liveScore.holesCompleted > 0 && (
            <span className="text-text-secondary text-xs">
              {liveScore.totalStrokes} strokes · {liveScore.holesCompleted} holes
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <button onClick={handlePrevHole} disabled={round.state.currentHole <= 1}
            className="text-text-secondary hover:text-text-primary disabled:opacity-30 px-3 py-2.5 min-h-[44px] text-lg font-bold">
            &larr;
          </button>
          <div className="text-center">
            <div className="text-xl font-bold">Hole {round.state.currentHole}</div>
            <div className="text-text-secondary text-xs">
              Par {currentHoleInfo.par}
              {currentHoleInfo.yardage > 0 && ` · ${currentHoleInfo.yardage} yds`}
            </div>
          </div>
          <button onClick={handleNextHole} disabled={round.state.currentHole >= round.state.holesPlayed}
            className="text-text-secondary hover:text-text-primary disabled:opacity-30 px-3 py-2.5 min-h-[44px] text-lg font-bold">
            &rarr;
          </button>
        </div>
      </div>

      {/* Shots on this hole (existing + new) */}
      {currentHoleAllShots.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-3">
          <div className="text-text-secondary text-xs font-medium mb-2 uppercase tracking-wider">
            Shots this hole
          </div>
          {currentHoleAllShots.map((shot, i) => {
            const existingCount = currentHoleAllShots.length - currentHoleNewShots.length;
            const isExisting = i < existingCount;
            // Find global index in existingShots array for this shot
            const existingIdx = isExisting
              ? existingShots.findIndex((s) => s === shot)
              : -1;
            const shotId = existingIdx >= 0 ? shotIdMap.get(existingIdx) : undefined;
            const isEditing = shotId !== undefined && editingShotId === shotId;

            if (isEditing) {
              return (
                <div key={i} className="py-2 border-b border-border/50 last:border-0 space-y-2">
                  <div className="text-text-muted text-xs">#{i + 1} Editing</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-text-muted text-xs">From</label>
                      <select value={editForm.surfaceStart} onChange={e => setEditForm(f => ({ ...f, surfaceStart: e.target.value }))}
                        className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary min-h-[44px]">
                        {SURFACES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-text-muted text-xs">Dist</label>
                      <input type="number" value={editForm.distanceStart} onChange={e => setEditForm(f => ({ ...f, distanceStart: +e.target.value }))}
                        className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary min-h-[44px]" />
                    </div>
                    <div>
                      <label className="text-text-muted text-xs">To</label>
                      <select value={editForm.surfaceEnd} onChange={e => setEditForm(f => ({ ...f, surfaceEnd: e.target.value }))}
                        className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary min-h-[44px]">
                        {END_SURFACES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-text-muted text-xs">Dist</label>
                      <input type="number" value={editForm.distanceEnd} disabled={editForm.surfaceEnd === 'Hole'}
                        onChange={e => setEditForm(f => ({ ...f, distanceEnd: +e.target.value }))}
                        className="w-full bg-bg-surface border border-border rounded px-2 py-1.5 text-sm text-text-primary min-h-[44px] disabled:opacity-30" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input type="checkbox" checked={editForm.penalty} onChange={e => setEditForm(f => ({ ...f, penalty: e.target.checked }))}
                      className="w-5 h-5 rounded" />
                    Penalty
                  </label>
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} disabled={actionLoading}
                      className="flex-1 bg-accent hover:bg-accent-hover text-white text-sm font-semibold py-2 rounded-lg min-h-[44px]">
                      {actionLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingShotId(null)}
                      className="flex-1 bg-bg-surface text-text-secondary text-sm py-2 rounded-lg min-h-[44px] hover:text-text-primary">
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="text-sm flex-1">
                  <span className="text-text-muted">#{i + 1}</span>{' '}
                  <span className="text-text-primary">{shot.surfaceStart} {shot.distanceStart}</span>
                  <span className="text-text-muted"> → </span>
                  <span className="text-text-primary">{shot.surfaceEnd} {shot.surfaceEnd !== 'Hole' ? shot.distanceEnd : ''}</span>
                </div>
                <span className={`text-sm font-semibold ${
                  shot.strokesGained > 0 ? 'text-sg-positive' : shot.strokesGained < 0 ? 'text-sg-negative' : 'text-sg-neutral'
                }`}>
                  {formatSG(shot.strokesGained)}
                </span>
                {isExisting && existingIdx >= 0 && (
                  <div className="flex gap-1 ml-2">
                    {confirmDeleteId === shotId ? (
                      <>
                        <button onClick={() => handleDelete(existingIdx)} disabled={actionLoading}
                          className="text-sg-negative text-xs px-2 py-1 min-h-[44px] font-semibold">Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="text-text-muted text-xs px-2 py-1 min-h-[44px]">No</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(shot, existingIdx)}
                          className="text-accent text-xs px-2 py-1 min-h-[44px]">Edit</button>
                        <button onClick={() => { setConfirmDeleteId(shotId!); setEditingShotId(null); }}
                          className="text-sg-negative text-xs px-2 py-1 min-h-[44px]">Del</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {currentHoleNewShots.length > 0 && (
            <button onClick={round.removeLastShot} className="text-sg-negative text-sm mt-2 py-2 min-h-[44px] hover:underline">
              Undo last shot
            </button>
          )}
        </div>
      )}

      {/* Shot Form or Hole Complete */}
      {previousShot?.surfaceEnd === 'Hole' ? (
        <div className="bg-bg-card border border-border rounded-xl p-5 text-center space-y-3">
          <div className="text-text-primary font-bold text-lg">Hole {round.state.currentHole} Complete</div>
          {(() => {
            const holeStrokes = currentHoleAllShots.reduce((n, s) => n + 1 + (s.penalty ? 1 : 0), 0);
            const holeToPar = holeStrokes - currentHoleInfo.par;
            const holeResult = holeToPar <= -2 ? 'Eagle' : holeToPar === -1 ? 'Birdie' : holeToPar === 0 ? 'Par' : holeToPar === 1 ? 'Bogey' : holeToPar === 2 ? 'Double' : 'Triple+';
            const resultColor = holeToPar < 0 ? 'text-sg-positive' : holeToPar > 0 ? 'text-sg-negative' : 'text-text-primary';
            return (
              <div className="text-sm">
                <span className={`font-bold text-lg ${resultColor}`}>{holeResult}</span>
                <span className="text-text-muted ml-2">{holeStrokes} strokes · Par {currentHoleInfo.par}</span>
              </div>
            );
          })()}
          {round.state.currentHole < round.state.holesPlayed ? (
            <button onClick={handleNextHole} className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-4 rounded-xl transition-colors text-lg">
              Next Hole →
            </button>
          ) : (
            <button onClick={handleFinish} disabled={saving}
              className="w-full bg-sg-positive hover:bg-sg-positive/90 text-bg-primary font-semibold py-4 rounded-xl transition-colors text-lg">
              {saving ? 'Saving...' : 'Save & Finish'}
            </button>
          )}
        </div>
      ) : (
        <ShotForm
          hole={round.state.currentHole}
          par={currentHoleInfo.par}
          shotNumber={shotNumber}
          benchmarks={round.state.benchmarks}
          previousShot={previousShot}
          holeYardage={currentHoleInfo.yardage}
          onAddShot={handleAddShot}
          playerId={player.playerId}
        />
      )}

      {/* Finish Round (available anytime with new shots) */}
      {round.state.shots.length > 0 && !(previousShot?.surfaceEnd === 'Hole' && round.state.currentHole >= round.state.holesPlayed) && (
        <button onClick={handleFinish} disabled={saving}
          className="w-full bg-sg-positive/20 text-sg-positive font-semibold py-4 rounded-xl hover:bg-sg-positive/30 transition-colors">
          {saving ? 'Saving...' : `Save & Finish (${round.state.shots.length} new shots)`}
        </button>
      )}

      {error && <p className="text-sg-negative text-sm text-center">{error}</p>}
    </div>
  );
};

export default ResumeEntry;
