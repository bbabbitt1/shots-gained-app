import { useMemo, useState } from 'react';
import { formatSG } from '@shared/sg-calculator';

interface AnalysisShot {
  Category: string;
  SurfaceStart: string;
  DistanceStart: number;
  SurfaceEnd: string;
  DistanceEnd: number;
  StrokesGained: number;
  ShotResult: string | null;
}

type View = 'sg' | 'proximity' | 'gir';

const BIN_SIZE = 10;

const ApproachChart = ({ shots }: { shots: AnalysisShot[] }) => {
  const [view, setView] = useState<View>('sg');

  const approachShots = useMemo(
    () => shots.filter((s) => s.Category === 'Approach' && s.SurfaceStart !== 'Recovery'),
    [shots]
  );

  const bins = useMemo(() => {
    const map = new Map<number, {
      sg: number;
      count: number;
      totalProx: number;
      girHit: number;
      girAttempts: number;
    }>();

    for (const s of approachShots) {
      const binStart = Math.floor(s.DistanceStart / BIN_SIZE) * BIN_SIZE;
      const entry = map.get(binStart) || { sg: 0, count: 0, totalProx: 0, girHit: 0, girAttempts: 0 };
      entry.sg += s.StrokesGained;
      entry.count += 1;
      // Proximity: distanceEnd × 3 to convert yards to feet (all surfaces)
      if (s.SurfaceEnd !== 'Hole') {
        entry.totalProx += s.DistanceEnd * 3;
        entry.girAttempts += 1;
        if (s.ShotResult === 'GIR') entry.girHit += 1;
      } else {
        // Holed it — 0 proximity, counts as GIR
        entry.girAttempts += 1;
        entry.girHit += 1;
      }
      map.set(binStart, entry);
    }

    return [...map.entries()]
      .map(([binStart, data]) => ({
        label: `${binStart}–${binStart + BIN_SIZE}`,
        binStart,
        sg: Math.round(data.sg * 1000) / 1000,
        avgProx: data.girAttempts > 0 ? Math.round((data.totalProx / data.girAttempts) * 10) / 10 : 0,
        girHit: data.girHit,
        girAttempts: data.girAttempts,
        count: data.count,
      }))
      .sort((a, b) => a.binStart - b.binStart);
  }, [approachShots]);

  const maxSG = Math.max(...bins.map((b) => Math.abs(b.sg)), 0.1);
  const maxProx = Math.max(...bins.map((b) => b.avgProx), 1);
  const maxGIR = 1; // percentage, max is 100%

  if (bins.length === 0) {
    return <p className="text-text-muted text-center py-8">No approach data</p>;
  }

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="text-text-secondary text-xs uppercase tracking-wider">
          {approachShots.length} shots
        </div>
        <div className="flex bg-bg-surface rounded-lg p-0.5 gap-0.5">
          {([['sg', 'SG'], ['proximity', 'Prox'], ['gir', 'GIR']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                view === key
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bars */}
      {bins.map((bin) => {
        if (view === 'sg') {
          const pct = (Math.abs(bin.sg) / maxSG) * 45;
          const barColor = bin.sg >= 0 ? 'bg-sg-positive' : 'bg-sg-negative';
          const textColor = bin.sg > 0 ? 'text-sg-positive' : bin.sg < 0 ? 'text-sg-negative' : 'text-sg-neutral';
          return (
            <div key={bin.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-medium w-16">{bin.label}</span>
                  <span className="text-text-muted text-xs">({bin.count})</span>
                </div>
                <span className={`font-semibold tabular-nums ${textColor}`}>{formatSG(bin.sg)}</span>
              </div>
              <div className="h-3 bg-bg-surface rounded-full relative">
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
                <div
                  className={`absolute top-0 bottom-0 rounded-full ${barColor} transition-all`}
                  style={bin.sg >= 0
                    ? { left: '50%', width: `${pct}%` }
                    : { right: '50%', width: `${pct}%` }
                  }
                />
              </div>
            </div>
          );
        }

        if (view === 'proximity') {
          const pct = (bin.avgProx / maxProx) * 85;
          return (
            <div key={bin.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-medium w-16">{bin.label}</span>
                  <span className="text-text-muted text-xs">({bin.count})</span>
                </div>
                <span className="text-text-primary font-semibold tabular-nums">{bin.avgProx.toFixed(1)} ft</span>
              </div>
              <div className="h-3 bg-bg-surface rounded-full relative">
                <div
                  className="absolute top-0 bottom-0 left-0 rounded-full bg-cat-approach transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        }

        // GIR view
        const girPct = bin.girAttempts > 0 ? (bin.girHit / bin.girAttempts) * 100 : 0;
        const barWidth = girPct * 0.85;
        return (
          <div key={bin.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2">
                <span className="text-text-primary font-medium w-16">{bin.label}</span>
                <span className="text-text-muted text-xs">({bin.count})</span>
              </div>
              <span className="text-text-primary font-semibold tabular-nums">
                {bin.girHit}/{bin.girAttempts} · {Math.round(girPct)}%
              </span>
            </div>
            <div className="h-3 bg-bg-surface rounded-full relative">
              <div
                className="absolute top-0 bottom-0 left-0 rounded-full bg-sg-positive transition-all"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ApproachChart;
