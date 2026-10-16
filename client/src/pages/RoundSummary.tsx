import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRound, saveShots, cacheCourse } from '../services/api';
import { savePendingRound, isOnline } from '../services/offline';
import { formatSG } from '@shared/sg-calculator';
import type { Shot, Category, SGByCategory } from '@shared/types';

const CATEGORIES: Category[] = ['Driving', 'Approach', 'Short Game', 'Putting'];

const RoundSummary = () => {
  const navigate = useNavigate();
  const [shots, setShots] = useState<Shot[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const setup = JSON.parse(sessionStorage.getItem('roundSetup') || '{}');
  const player = JSON.parse(localStorage.getItem('player') || '{}');

  useEffect(() => {
    const data = sessionStorage.getItem('roundShots');
    if (!data) { navigate('/round/setup'); return; }
    setShots(JSON.parse(data));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sgByCategory = useMemo((): SGByCategory => {
    const result: SGByCategory = { Driving: 0, Approach: 0, 'Short Game': 0, Putting: 0 };
    for (const shot of shots) {
      result[shot.category] += shot.strokesGained;
    }
    for (const key of CATEGORIES) {
      result[key] = Math.round(result[key] * 1000) / 1000;
    }
    return result;
  }, [shots]);

  const totalSG = useMemo(
    () => Math.round(shots.reduce((sum, s) => sum + s.strokesGained, 0) * 1000) / 1000,
    [shots]
  );

  // Score calculation
  const scoreByHole = useMemo(() => {
    const holes = new Map<number, { par: number; shots: number }>();
    for (const shot of shots) {
      const existing = holes.get(shot.hole) || { par: shot.par, shots: 0 };
      existing.shots += 1;
      if (shot.penalty) existing.shots += 1;
      holes.set(shot.hole, existing);
    }
    return holes;
  }, [shots]);

  const totalStrokes = useMemo(() => {
    let total = 0;
    for (const h of scoreByHole.values()) total += h.shots;
    return total;
  }, [scoreByHole]);

  const totalPar = useMemo(() => {
    let total = 0;
    for (const h of scoreByHole.values()) total += h.par;
    return total;
  }, [scoreByHole]);

  const scoreToPar = totalStrokes - totalPar;

  const [savedOffline, setSavedOffline] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    // If offline, queue for later sync
    if (!isOnline()) {
      try {
        await savePendingRound(setup, shots);
        setSaved(true);
        setSavedOffline(true);
        sessionStorage.removeItem('roundSetup');
        sessionStorage.removeItem('roundShots');
      } catch {
        setError('Failed to save offline');
      }
      setSaving(false);
      return;
    }

    try {
      const courseRes = await cacheCourse({
        clubName: setup.course.clubName,
        courseName: setup.course.courseName,
        apiSourceId: setup.course.apiSourceId,
        holes: setup.holes?.map((h: { holeNumber: number; par: number; yardage: number }) => ({
          holeNumber: h.holeNumber,
          par: h.par,
          yardage: h.yardage,
          tee: setup.tee,
        })),
      });

      const roundRes = await createRound({
        courseId: courseRes.courseId,
        roundDate: setup.roundDate,
        holesPlayed: setup.holesPlayed,
        teePreference: setup.tee,
        benchmark: 'Pro',
      });

      await saveShots(roundRes.roundId, shots);
      setSaved(true);
      sessionStorage.removeItem('roundSetup');
      sessionStorage.removeItem('roundShots');
    } catch {
      // Online save failed — save offline as fallback
      try {
        await savePendingRound(setup, shots);
        setSaved(true);
        setSavedOffline(true);
        sessionStorage.removeItem('roundSetup');
        sessionStorage.removeItem('roundShots');
      } catch (err2) {
        setError(err2 instanceof Error ? err2.message : 'Failed to save');
      }
    }
    setSaving(false);
  };

  const sgColor = (val: number) =>
    val > 0 ? 'text-sg-positive' : val < 0 ? 'text-sg-negative' : 'text-sg-neutral';

  // Find max absolute value for bar scaling
  const maxAbs = Math.max(...CATEGORIES.map((c) => Math.abs(sgByCategory[c])), 0.1);

  return (
    <div className="min-h-dvh px-4 pt-6 pb-10 max-w-lg mx-auto space-y-6">
      <div>
        <span className="eyebrow inline-block rounded-full bg-white/[0.04] px-3 py-1 ring-1 ring-white/10">Round complete</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Round Summary</h1>
      </div>

      {/* Score */}
      <div className="card p-5 text-center animate-rise">
        <div className="num text-5xl font-semibold">{totalStrokes}</div>
        <div className="text-text-secondary text-sm">
          {scoreToPar === 0 ? 'Even' : scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar} ({totalPar} par)
        </div>
      </div>

      {/* Total SG */}
      <div className="card p-5 text-center animate-rise [animation-delay:80ms]">
        <div className="eyebrow mb-1">Total Shots Gained</div>
        <div className={`num text-4xl font-semibold ${sgColor(totalSG)}`}>{formatSG(totalSG)}</div>
      </div>

      {/* SG by Category — horizontal bars */}
      <div className="card p-5 space-y-3 animate-rise [animation-delay:160ms]">
        <div className="eyebrow">By Category</div>
        {CATEGORIES.map((cat) => {
          const val = sgByCategory[cat];
          const pct = (Math.abs(val) / maxAbs) * 50;
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

      {/* Actions */}
      {!saved ? (
        <div className="space-y-3">
          {error && <p className="text-sg-negative text-sm text-center">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full btn-primary"
          >
            {saving ? 'Saving...' : 'Save Round'}
          </button>
          <button
            onClick={() => navigate('/round/play')}
            className="w-full btn-secondary"
          >
            Back to Round
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sg-positive text-center font-medium">
            {savedOffline ? 'Saved offline — will sync when connected' : 'Round saved!'}
          </p>
          <button
            onClick={() => navigate('/home')}
            className="w-full btn-primary"
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate('/round/setup')}
            className="w-full btn-secondary"
          >
            New Round
          </button>
        </div>
      )}
    </div>
  );
};

export default RoundSummary;
