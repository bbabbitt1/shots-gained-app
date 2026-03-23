import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getHoleScores } from '../services/api';
import { formatSG } from '@shared/sg-calculator';
import type { Category, SGByCategory } from '@shared/types';

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

const CATEGORIES: Category[] = ['Driving', 'Approach', 'Short Game', 'Putting'];

const RoundDetail = () => {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const [holes, setHoles] = useState<HoleScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roundId) return;
    getHoleScores(parseInt(roundId))
      .then(setHoles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roundId]);

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

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center"><p className="text-text-secondary">Loading...</p></div>;
  }

  if (holes.length === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center flex-col gap-3">
        <p className="text-text-secondary">No data for this round</p>
        <button onClick={() => navigate('/rounds')} className="text-accent hover:underline text-sm py-2 min-h-[44px]">Back to rounds</button>
      </div>
    );
  }

  const maxAbsSG = Math.max(...CATEGORIES.map((c) => Math.abs(totals.sg[c])), 0.1);

  return (
    <div className="min-h-dvh px-4 pt-6 pb-10 max-w-lg mx-auto space-y-4">
      <button onClick={() => navigate('/rounds')} className="text-text-secondary text-sm py-2 min-h-[44px] hover:text-text-primary transition-colors">
        ← Rounds
      </button>

      {/* Score */}
      <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
        <div className="text-4xl font-bold">{totals.strokes}</div>
        <div className="text-text-secondary text-sm">
          {totals.scoreToPar === 0 ? 'Even' : totals.scoreToPar > 0 ? `+${totals.scoreToPar}` : totals.scoreToPar} ({totals.par} par)
        </div>
      </div>

      {/* Total SG */}
      <div className="bg-bg-card border border-border rounded-xl p-4 text-center">
        <div className="text-text-secondary text-xs uppercase tracking-wider mb-1">Total Shots Gained</div>
        <div className={`text-3xl font-bold ${sgColor(totals.sgTotal)}`}>{formatSG(totals.sgTotal)}</div>
      </div>

      {/* SG by Category */}
      <div className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="text-text-secondary text-xs uppercase tracking-wider">By Category</div>
        {CATEGORIES.map((cat) => {
          const val = totals.sg[cat];
          const pct = (Math.abs(val) / maxAbsSG) * 50;
          const barColor = val >= 0 ? 'bg-sg-positive' : 'bg-sg-negative';
          return (
            <div key={cat}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-primary">{cat}</span>
                <span className={`font-semibold ${sgColor(val)}`}>{formatSG(val)}</span>
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
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">Stats</div>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-text-secondary text-xs uppercase">FIR</div>
            <div className="text-text-primary font-semibold text-sm">
              {totals.firTotal > 0 ? `${totals.firHit}/${totals.firTotal}` : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-text-secondary text-xs uppercase">GIR</div>
            <div className="text-text-primary font-semibold text-sm">
              {`${totals.girHit}/${totals.girTotal}`}
            </div>
          </div>
          <div className="text-center">
            <div className="text-text-secondary text-xs uppercase">↑/↓</div>
            <div className="text-text-primary font-semibold text-sm">
              {totals.udTotal > 0 ? `${totals.udConv}/${totals.udTotal}` : '—'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-text-secondary text-xs uppercase">Putts</div>
            <div className="text-text-primary font-semibold text-sm">{totals.putts}</div>
          </div>
        </div>
      </div>

      {/* Hole-by-Hole */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">Hole by Hole</div>
        <div className="space-y-1">
          <div className="grid grid-cols-[2.5rem_2.5rem_2.5rem_3.5rem_1fr] gap-2 text-xs text-text-secondary uppercase tracking-wider pb-1 border-b border-border/50">
            <div>#</div>
            <div>Par</div>
            <div>Scr</div>
            <div>SG</div>
            <div>Result</div>
          </div>
          {holes.map((h) => (
            <div key={h.Hole} className="grid grid-cols-[2.5rem_2.5rem_2.5rem_3.5rem_1fr] gap-2 text-sm py-1.5 border-b border-border/30 last:border-0">
              <div className="text-text-secondary">{h.Hole}</div>
              <div className="text-text-secondary">{h.Par}</div>
              <div className={`font-semibold ${scoreColor(h.ScoreToPar)}`}>{h.Score}</div>
              <div className={`font-semibold ${sgColor(h.SGTotal)}`}>{formatSG(h.SGTotal)}</div>
              <div className={`text-xs self-center ${scoreColor(h.ScoreToPar)}`}>{h.HoleResult}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoundDetail;
