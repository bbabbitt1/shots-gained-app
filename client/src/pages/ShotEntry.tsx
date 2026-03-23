import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SGTracker from '../components/SGTracker';
import ShotForm from '../components/ShotForm';
import { getBenchmarks } from '../services/api';
import { cacheBenchmarks, getCachedBenchmarks } from '../services/offline';
import { useRound } from '../hooks/useRound';
import { formatSG } from '@shared/sg-calculator';
import type { Shot, BenchmarkRow } from '@shared/types';

const ShotEntry = () => {
  const navigate = useNavigate();
  const round = useRound();
  const [benchmarksLoaded, setBenchmarksLoaded] = useState(false);

  const player = JSON.parse(localStorage.getItem('player') || '{}');

  // Load round setup from sessionStorage
  useEffect(() => {
    const setup = sessionStorage.getItem('roundSetup');
    if (!setup) { navigate('/round/setup'); return; }

    const data = JSON.parse(setup);
    round.setCourse(data.course, data.tee, data.holes, data.holesPlayed);
    round.setState((s) => ({ ...s, roundDate: data.roundDate }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load benchmarks — try API first, fall back to cached
  useEffect(() => {
    const load = async () => {
      try {
        const data: BenchmarkRow[] = await getBenchmarks();
        round.setBenchmarks(data);
        setBenchmarksLoaded(true);
        cacheBenchmarks(data); // cache for offline use
      } catch {
        const cached = await getCachedBenchmarks();
        if (cached) {
          round.setBenchmarks(cached);
          setBenchmarksLoaded(true);
        } else {
          console.error('No benchmarks available (offline, no cache)');
        }
      }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get hole info from course data
  const currentHoleInfo = useMemo(() => {
    const hole = round.state.holes.find((h) => h.holeNumber === round.state.currentHole);
    return hole || { holeNumber: round.state.currentHole, par: 4, yardage: 0 };
  }, [round.state.holes, round.state.currentHole]);

  const currentHoleShots = round.currentHoleShots;
  const shotNumber = currentHoleShots.length + 1;
  const previousShot = currentHoleShots.length > 0 ? currentHoleShots[currentHoleShots.length - 1] : null;

  const handleAddShot = (shot: Shot) => {
    round.addShot({
      ...shot,
      hole: round.state.currentHole,
      par: currentHoleInfo.par,
    });
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

  const handleFinish = () => {
    sessionStorage.setItem('roundShots', JSON.stringify(round.state.shots));
    navigate('/round/summary');
  };

  // Live score computation
  const liveScore = useMemo(() => {
    const holes = new Map<number, { par: number; shots: number }>();
    for (const s of round.state.shots) {
      const h = holes.get(s.hole) || { par: s.par, shots: 0 };
      h.shots += 1;
      if (s.penalty) h.shots += 1;
      holes.set(s.hole, h);
    }

    let totalStrokes = 0;
    let totalPar = 0;
    // Only count completed holes (last shot ended in Hole)
    for (const [holeNum, data] of holes) {
      const holeShots = round.state.shots.filter((s) => s.hole === holeNum);
      const lastShot = holeShots[holeShots.length - 1];
      if (lastShot?.surfaceEnd === 'Hole') {
        totalStrokes += data.shots;
        totalPar += data.par;
      }
    }

    return { totalStrokes, totalPar, scoreToPar: totalStrokes - totalPar, holesCompleted: [...holes.entries()].filter(([holeNum]) => {
      const holeShots = round.state.shots.filter((s) => s.hole === holeNum);
      return holeShots[holeShots.length - 1]?.surfaceEnd === 'Hole';
    }).length };
  }, [round.state.shots]);

  const scoreDisplay = liveScore.holesCompleted === 0
    ? 'E'
    : liveScore.scoreToPar === 0
      ? 'E'
      : liveScore.scoreToPar > 0
        ? `+${liveScore.scoreToPar}`
        : `${liveScore.scoreToPar}`;

  const scoreColor = liveScore.scoreToPar < 0
    ? 'text-sg-positive'
    : liveScore.scoreToPar > 0
      ? 'text-sg-negative'
      : 'text-text-primary';

  if (!benchmarksLoaded) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-text-secondary">Loading benchmarks...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-4 pt-4 pb-8 max-w-lg mx-auto space-y-4">
      {/* SG Tracker */}
      <SGTracker sgByCategory={round.sgByCategory} totalSG={round.totalSG} shots={round.state.shots} />

      {/* Score + Hole Navigation */}
      <div className="bg-bg-card border border-border rounded-xl p-3 space-y-2">
        {/* Live Score */}
        <div className="flex items-center justify-center gap-3">
          <span className={`text-2xl font-bold ${scoreColor}`}>{scoreDisplay}</span>
          {liveScore.holesCompleted > 0 && (
            <span className="text-text-muted text-xs">
              {liveScore.totalStrokes} strokes · {liveScore.holesCompleted} holes
            </span>
          )}
        </div>
        {/* Hole Nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevHole}
            disabled={round.state.currentHole <= 1}
            className="text-text-secondary hover:text-text-primary disabled:opacity-30 px-3 py-1 text-lg font-bold"
          >
            &larr;
          </button>
          <div className="text-center">
            <div className="text-xl font-bold">Hole {round.state.currentHole}</div>
            <div className="text-text-secondary text-xs">
              Par {currentHoleInfo.par}
              {currentHoleInfo.yardage > 0 && ` · ${currentHoleInfo.yardage} yds`}
            </div>
          </div>
          <button
            onClick={handleNextHole}
            disabled={round.state.currentHole >= round.state.holesPlayed}
            className="text-text-secondary hover:text-text-primary disabled:opacity-30 px-3 py-1 text-lg font-bold"
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Shots on this hole */}
      {currentHoleShots.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-3">
          <div className="text-text-secondary text-xs font-medium mb-2 uppercase tracking-wider">
            Shots this hole
          </div>
          {currentHoleShots.map((shot, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <div className="text-sm">
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
            </div>
          ))}
          <button
            onClick={round.removeLastShot}
            className="text-sg-negative text-xs mt-2 hover:underline"
          >
            Undo last shot
          </button>
        </div>
      )}

      {/* Shot Form or Hole Complete */}
      {previousShot?.surfaceEnd === 'Hole' ? (
        <div className="bg-bg-card border border-border rounded-xl p-5 text-center space-y-3">
          <div className="text-text-primary font-bold text-lg">
            Hole {round.state.currentHole} Complete
          </div>
          {(() => {
            const holeStrokes = currentHoleShots.reduce((n, s) => n + 1 + (s.penalty ? 1 : 0), 0);
            const holeToPar = holeStrokes - currentHoleInfo.par;
            const holeResult =
              holeToPar <= -2 ? 'Eagle' :
              holeToPar === -1 ? 'Birdie' :
              holeToPar === 0 ? 'Par' :
              holeToPar === 1 ? 'Bogey' :
              holeToPar === 2 ? 'Double' : 'Triple+';
            const resultColor = holeToPar < 0 ? 'text-sg-positive' : holeToPar > 0 ? 'text-sg-negative' : 'text-text-primary';
            return (
              <div className="text-sm">
                <span className={`font-bold text-lg ${resultColor}`}>{holeResult}</span>
                <span className="text-text-muted ml-2">{holeStrokes} strokes · Par {currentHoleInfo.par}</span>
              </div>
            );
          })()}
          {round.state.currentHole < round.state.holesPlayed ? (
            <button
              onClick={handleNextHole}
              className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-4 rounded-lg transition-colors text-lg"
            >
              Next Hole →
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="w-full bg-sg-positive hover:bg-sg-positive/90 text-bg-primary font-semibold py-4 rounded-lg transition-colors text-lg"
            >
              Finish Round
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

      {/* Finish Round (available anytime) */}
      {round.state.shots.length > 0 && !(previousShot?.surfaceEnd === 'Hole' && round.state.currentHole >= round.state.holesPlayed) && (
        <button
          onClick={handleFinish}
          className="w-full bg-sg-positive/20 text-sg-positive font-semibold py-3 rounded-lg hover:bg-sg-positive/30 transition-colors"
        >
          Finish Round ({round.state.shots.length} shots)
        </button>
      )}
    </div>
  );
};

export default ShotEntry;
