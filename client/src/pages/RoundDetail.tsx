import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getHoleScores, getShots, getRound, deleteRound, updateShot, deleteShot, getBenchmarks } from '../services/api';
import { formatSG, calculateStrokesGained } from '@shared/sg-calculator';
import Icon from '../components/Icons';
import type { Category, SGByCategory, Shot, BenchmarkRow } from '@shared/types';

interface HoleScore {
  Hole: number;
  Par: number;
  Score: number;
  ScoreToPar: number;
  HoleResult: string;
  FairwayResult: string | null;
  GreenInReg: boolean;
  Putts: number;
  UpAndDown: boolean | null;
  SGTotal: number;
  SGDriving: number;
  SGApproach: number;
  SGShortGame: number;
  SGPutting: number;
}

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
  Penalty: boolean;
  StrokesGained: number;
}

interface RoundMeta {
  RoundID: number;
  CourseID: number;
  RoundDate: string;
  HolesPlayed: number;
  TeePreference: string;
  Benchmark: string;
  ClubName: string;
  CourseName: string;
}

const CATEGORIES: Category[] = ['Driving', 'Approach', 'Short Game', 'Putting'];
const SURFACES = ['Tee', 'Fairway', 'Rough', 'Bunker', 'Green', 'Recovery'] as const;
const END_SURFACES = [...SURFACES, 'Hole'] as const;

const RoundDetail = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const [holes, setHoles] = useState<HoleScore[]>([]);
  const [shots, setShots] = useState<DBShot[]>([]);
  const [roundMeta, setRoundMeta] = useState<RoundMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedHole, setExpandedHole] = useState<number | null>(null);
  const [editingShot, setEditingShot] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<DBShot>>({});
  const [confirmDelete, setConfirmDelete] = useState<'round' | number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);

  const rid = parseInt(roundId || '0');

  const loadData = useCallback(async () => {
    if (!rid) return;
    try {
      const [h, s, r, b] = await Promise.all([
        getHoleScores(rid),
        getShots(rid),
        getRound(rid),
        getBenchmarks().catch(() => []),
      ]);
      setHoles(h);
      setShots(s);
      setRoundMeta(r);
      setBenchmarks(b);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => { loadData(); }, [loadData]);

  const totals = useMemo(() => {
    const sg: SGByCategory = { Driving: 0, Approach: 0, 'Short Game': 0, Putting: 0 };
    let strokes = 0, par = 0, putts = 0, firHit = 0, firTotal = 0, girHit = 0, udConv = 0, udTotal = 0;

    for (const h of holes) {
      strokes += h.Score;
      par += h.Par;
      putts += h.Putts;
      sg.Driving += h.SGDriving;
      sg.Approach += h.SGApproach;
      sg['Short Game'] += h.SGShortGame;
      sg.Putting += h.SGPutting;

      if (h.Par >= 4 && h.FairwayResult) {
        firTotal++;
        if (h.FairwayResult === 'Hit Fairway' || h.FairwayResult === 'Drive Green') firHit++;
      }
      if (h.GreenInReg) girHit++;
      if (h.UpAndDown !== null) {
        udTotal++;
        if (h.UpAndDown) udConv++;
      }
    }

    const sgTotal = sg.Driving + sg.Approach + sg['Short Game'] + sg.Putting;
    return { sg, sgTotal, strokes, par, scoreToPar: strokes - par, putts, firHit, firTotal, girHit, girTotal: holes.length, udConv, udTotal };
  }, [holes]);

  const sgColor = (v: number) => v > 0 ? 'text-sg-positive' : v < 0 ? 'text-sg-negative' : 'text-sg-neutral';
  const scoreColor = (v: number) => v < 0 ? 'text-sg-positive' : v > 0 ? 'text-sg-negative' : 'text-text-primary';

  const shotsForHole = (holeNum: number) => shots.filter((s) => s.Hole === holeNum);

  const handleDeleteRound = async () => {
    setActionLoading(true);
    try {
      await deleteRound(rid);
      navigate('/rounds');
    } catch {
      setActionLoading(false);
    }
  };

  const handleDeleteShot = async (shotId: number) => {
    setActionLoading(true);
    setActionError('');
    try {
      await deleteShot(shotId);
      setConfirmDelete(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed');
    }
    setActionLoading(false);
  };

  const startEdit = (shot: DBShot) => {
    setEditingShot(shot.ShotID);
    setEditForm({
      SurfaceStart: shot.SurfaceStart,
      DistanceStart: shot.DistanceStart,
      SurfaceEnd: shot.SurfaceEnd,
      DistanceEnd: shot.DistanceEnd,
      ClubUsed: shot.ClubUsed,
      Penalty: shot.Penalty,
      Category: shot.Category,
    });
  };

  const handleSaveEdit = async (shot: DBShot) => {
    setActionLoading(true);
    try {
      // Recalculate SG if positions changed
      let sg = shot.StrokesGained;
      if (benchmarks.length > 0 && (
        editForm.SurfaceStart !== shot.SurfaceStart ||
        editForm.DistanceStart !== shot.DistanceStart ||
        editForm.SurfaceEnd !== shot.SurfaceEnd ||
        editForm.DistanceEnd !== shot.DistanceEnd ||
        editForm.Penalty !== shot.Penalty
      )) {
        sg = calculateStrokesGained(benchmarks, {
          surfaceStart: editForm.SurfaceStart as any,
          distanceStart: editForm.DistanceStart!,
          surfaceEnd: editForm.SurfaceEnd as any,
          distanceEnd: editForm.DistanceEnd!,
          penalty: editForm.Penalty || false,
        });
      }

      await updateShot(shot.ShotID, {
        surfaceStart: editForm.SurfaceStart,
        distanceStart: editForm.DistanceStart,
        surfaceEnd: editForm.SurfaceEnd,
        distanceEnd: editForm.DistanceEnd === undefined ? 0 : editForm.DistanceEnd,
        clubUsed: editForm.ClubUsed || undefined,
        penalty: !!editForm.Penalty,
        category: editForm.Category,
        strokesGained: sg,
      });
      setEditingShot(null);
      setActionError('');
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Update failed');
    }
    setActionLoading(false);
  };

  const handleResumeRound = () => {
    navigate(`/round/resume/${rid}`);
  };

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center"><p className="text-text-secondary">Loading...</p></div>;
  }

  if (holes.length === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center flex-col gap-3">
        <p className="text-text-secondary">No data for this round</p>
        <div className="flex gap-3">
          <button onClick={() => navigate('/rounds')} className="text-accent hover:underline text-sm py-2 min-h-[44px]">Back to rounds</button>
          {roundMeta && (
            <button onClick={handleResumeRound} className="text-sg-positive hover:underline text-sm py-2 min-h-[44px]">Add shots</button>
          )}
        </div>
      </div>
    );
  }

  const maxAbsSG = Math.max(...CATEGORIES.map((c) => Math.abs(totals.sg[c])), 0.1);

  return (
    <div className="min-h-dvh px-4 pt-6 pb-32 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/rounds')} className="btn-ghost -ml-3">
          <Icon name="chevronLeft" className="w-4 h-4" />Rounds
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleResumeRound}
            className="btn-secondary min-h-[44px] px-4 text-sm text-accent bg-accent/10 ring-accent/30 hover:bg-accent/20"
          >
            Continue Round
          </button>
          <button
            onClick={() => setConfirmDelete('round')}
            className="btn-secondary min-h-[44px] px-4 text-sm text-sg-negative bg-sg-negative/10 ring-sg-negative/30 hover:bg-sg-negative/20"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Action Error */}
      {actionError && (
        <div className="bg-sg-negative/10 ring-1 ring-sg-negative/30 rounded-2xl p-3 text-sg-negative text-sm">
          {actionError}
        </div>
      )}

      {/* Delete Round Confirmation */}
      {confirmDelete === 'round' && (
        <div className="bg-sg-negative/10 ring-1 ring-sg-negative/30 rounded-2xl p-4 space-y-3">
          <p className="text-text-primary text-sm">Delete this entire round? This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteRound}
              disabled={actionLoading}
              className="btn-primary flex-1 min-h-[48px] text-sm bg-sg-negative shadow-none"
            >
              {actionLoading ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(null)}
              className="btn-secondary flex-1 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Round info */}
      {roundMeta && (
        <div className="text-center text-text-secondary text-xs">
          {roundMeta.ClubName} — {roundMeta.CourseName} · {roundMeta.TeePreference} tees · {new Date(roundMeta.RoundDate).toLocaleDateString()}
        </div>
      )}

      {/* Score */}
      <div className="card p-4 text-center">
        <div className="num text-5xl font-semibold">{totals.strokes}</div>
        <div className="text-text-secondary text-sm">
          {totals.scoreToPar === 0 ? 'Even' : totals.scoreToPar > 0 ? `+${totals.scoreToPar}` : totals.scoreToPar} ({totals.par} par)
        </div>
      </div>

      {/* Total SG */}
      <div className="card p-4 text-center">
        <div className="eyebrow mb-1">Total Shots Gained</div>
        <div className={`num text-4xl font-semibold ${sgColor(totals.sgTotal)}`}>{formatSG(totals.sgTotal)}</div>
      </div>

      {/* SG by Category */}
      <div className="card p-4 space-y-3">
        <div className="eyebrow">By Category</div>
        {CATEGORIES.map((cat) => {
          const val = totals.sg[cat];
          const pct = (Math.abs(val) / maxAbsSG) * 50;
          const barColor = val >= 0 ? 'bg-sg-positive' : 'bg-sg-negative';
          return (
            <div key={cat}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-primary">{cat}</span>
                <span className={`num font-semibold ${sgColor(val)}`}>{formatSG(val)}</span>
              </div>
              <div className="h-2 bg-bg-surface rounded-full relative">
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
                <div
                  className={`absolute top-0 bottom-0 rounded-full ${barColor} transition-all`}
                  style={val >= 0
                    ? { left: '50%', width: `${pct}%` }
                    : { right: '50%', width: `${pct}%` }
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Round Stats */}
      <div className="card p-4">
        <div className="eyebrow mb-3">Stats</div>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="eyebrow">FIR</div>
            <div className="num text-text-primary font-semibold text-sm">
              {totals.firTotal > 0 ? `${totals.firHit}/${totals.firTotal}` : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="eyebrow">GIR</div>
            <div className="num text-text-primary font-semibold text-sm">
              {`${totals.girHit}/${totals.girTotal}`}
            </div>
          </div>
          <div className="text-center">
            <div className="eyebrow">↑/↓</div>
            <div className="num text-text-primary font-semibold text-sm">
              {totals.udTotal > 0 ? `${totals.udConv}/${totals.udTotal}` : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="eyebrow">Putts</div>
            <div className="num text-text-primary font-semibold text-sm">{totals.putts}</div>
          </div>
        </div>
      </div>

      {/* Hole-by-Hole (expandable) */}
      <div className="card p-4">
        <div className="eyebrow mb-3">Hole by Hole</div>
        <div className="space-y-1">
          <div className="grid grid-cols-[2.5rem_2.5rem_2.5rem_3.5rem_1fr] gap-2 eyebrow pb-1 px-2 border-b border-white/5">
            <div>#</div>
            <div>Par</div>
            <div>Scr</div>
            <div>SG</div>
            <div>Result</div>
          </div>
          {holes.map((h) => (
            <div key={h.Hole}>
              {/* Hole row — tap to expand */}
              <button
                type="button"
                aria-expanded={expandedHole === h.Hole}
                onClick={() => setExpandedHole(expandedHole === h.Hole ? null : h.Hole)}
                className="num grid w-full grid-cols-[2.5rem_2.5rem_2.5rem_3.5rem_1fr] items-center gap-2 text-left text-sm min-h-[44px] px-2 rounded-xl border-b border-white/5 hover:bg-white/[0.03] transition-colors duration-200 ease-spring"
              >
                <div className="text-text-secondary">{h.Hole}</div>
                <div className="text-text-secondary">{h.Par}</div>
                <div className={`font-semibold ${scoreColor(h.ScoreToPar)}`}>{h.Score}</div>
                <div className={`font-semibold ${sgColor(h.SGTotal)}`}>{formatSG(h.SGTotal)}</div>
                <div className="flex items-center justify-between">
                  <span className={`font-sans text-xs ${scoreColor(h.ScoreToPar)}`}>{h.HoleResult}</span>
                  <Icon name="chevronRight" className={`w-4 h-4 text-text-muted transition-transform duration-300 ease-spring ${expandedHole === h.Hole ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {/* Expanded: individual shots */}
              {expandedHole === h.Hole && (
                <div className="tile my-1 p-3 space-y-2">
                  {shotsForHole(h.Hole).map((shot, i) => (
                    <div key={shot.ShotID}>
                      {editingShot === shot.ShotID ? (
                        /* Edit form */
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-text-muted text-xs">From</label>
                              <select
                                value={editForm.SurfaceStart}
                                onChange={(e) => setEditForm({ ...editForm, SurfaceStart: e.target.value })}
                                className="w-full"
                              >
                                {SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-text-muted text-xs">Distance</label>
                              <input
                                type="number"
                                value={editForm.DistanceStart ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, DistanceStart: Number(e.target.value) })}
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="text-text-muted text-xs">To</label>
                              <select
                                value={editForm.SurfaceEnd}
                                onChange={(e) => setEditForm({ ...editForm, SurfaceEnd: e.target.value })}
                                className="w-full"
                              >
                                {END_SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-text-muted text-xs">Distance</label>
                              <input
                                type="number"
                                value={editForm.DistanceEnd ?? ''}
                                onChange={(e) => setEditForm({ ...editForm, DistanceEnd: Number(e.target.value) })}
                                className="w-full"
                                disabled={editForm.SurfaceEnd === 'Hole'}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-sm text-text-secondary">
                              <input
                                type="checkbox"
                                checked={editForm.Penalty || false}
                                onChange={(e) => setEditForm({ ...editForm, Penalty: e.target.checked })}
                                className="rounded"
                              />
                              Penalty
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(shot)}
                              disabled={actionLoading}
                              className="btn-primary flex-1 min-h-[44px] text-sm"
                            >
                              {actionLoading ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingShot(null)}
                              className="btn-secondary flex-1 min-h-[44px] text-sm text-text-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Shot display row */
                        <div className="flex items-center justify-between">
                          <div className="num text-sm flex-1">
                            <span className="text-text-muted">#{i + 1}</span>{' '}
                            <span className="text-text-primary">{shot.SurfaceStart} {shot.DistanceStart}</span>
                            <span className="text-text-muted"> → </span>
                            <span className="text-text-primary">{shot.SurfaceEnd} {shot.SurfaceEnd !== 'Hole' ? shot.DistanceEnd : ''}</span>
                            {shot.ClubUsed && <span className="text-text-muted text-xs ml-1">({shot.ClubUsed})</span>}
                            {shot.Penalty && <span className="text-sg-negative text-xs ml-1">+P</span>}
                          </div>
                          <span className={`num text-sm font-semibold mr-2 ${sgColor(shot.StrokesGained)}`}>
                            {formatSG(shot.StrokesGained)}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(shot)}
                              className="text-accent text-xs px-2 py-1 min-h-[44px] min-w-[36px] hover:bg-accent/10 rounded"
                            >
                              Edit
                            </button>
                            {confirmDelete === shot.ShotID ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleDeleteShot(shot.ShotID)}
                                  disabled={actionLoading}
                                  className="text-sg-negative text-xs px-2 py-1 min-h-[44px] bg-sg-negative/10 rounded font-medium"
                                >
                                  {actionLoading ? '...' : 'Yes'}
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="text-text-secondary text-xs px-2 py-1 min-h-[44px] rounded"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(shot.ShotID)}
                                className="text-sg-negative text-xs px-2 py-1 min-h-[44px] min-w-[36px] hover:bg-sg-negative/10 rounded"
                              >
                                Del
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {shotsForHole(h.Hole).length === 0 && (
                    <p className="text-text-muted text-xs">No shots recorded</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoundDetail;
