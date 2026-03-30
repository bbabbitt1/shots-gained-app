import { useMemo, useState } from 'react';
import { formatSG } from '@shared/sg-calculator';

interface AnalysisShot {
  Category: string;
  DistanceStart: number;
  SurfaceEnd: string;
  StrokesGained: number;
}

type View = 'sg' | 'makeRate';

const BIN_SIZE = 5;

const PuttingChart = ({ shots }: { shots: AnalysisShot[] }) => {
  const [view, setView] = useState<View>('sg');

  const puttingShots = useMemo(
    () => shots.filter((s) => s.Category === 'Putting'),
    [shots]
  );

  const bins = useMemo(() => {
    const map = new Map<number, { sg: number; count: number; makes: number }>();

    for (const s of puttingShots) {
      // distanceStart is in feet for putting
      const binStart = Math.max(1, Math.floor((s.DistanceStart - 1) / BIN_SIZE) * BIN_SIZE + 1);
      const entry = map.get(binStart) || { sg: 0, count: 0, makes: 0 };
      entry.sg += s.StrokesGained;
      entry.count += 1;
      if (s.SurfaceEnd === 'Hole') entry.makes += 1;
      map.set(binStart, entry);
    }

    return [...map.entries()]
      .map(([binStart, data]) => ({
        label: `${binStart}–${binStart + BIN_SIZE - 1}`,
        binStart,
        sg: Math.round(data.sg * 1000) / 1000,
        makes: data.makes,
        count: data.count,
        makePct: data.count > 0 ? Math.round((data.makes / data.count) * 100) : 0,
      }))
      .sort((a, b) => a.binStart - b.binStart);
  }, [puttingShots]);

  const maxSG = Math.max(...bins.map((b) => Math.abs(b.sg)), 0.1);

  if (bins.length === 0) {
    return <p className="text-text-muted text-center py-8">No putting data</p>;
  }

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="text-text-secondary text-xs uppercase tracking-wider">
          {puttingShots.length} putts
        </div>
        <div className="flex bg-bg-surface rounded-lg p-0.5 gap-0.5">
          {([['sg', 'SG'], ['makeRate', 'Make %']] as const).map(([key, label]) => (
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
                  <span className="text-text-primary font-medium w-14">{bin.label} ft</span>
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

        // Make Rate view
        const barWidth = bin.makePct * 0.85;
        return (
          <div key={bin.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2">
                <span className="text-text-primary font-medium w-14">{bin.label} ft</span>
                <span className="text-text-muted text-xs">({bin.count})</span>
              </div>
              <span className="text-text-primary font-semibold tabular-nums">
                {bin.makes}/{bin.count} · {bin.makePct}%
              </span>
            </div>
            <div className="h-3 bg-bg-surface rounded-full relative">
              <div
                className="absolute top-0 bottom-0 left-0 rounded-full bg-cat-putting transition-all"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PuttingChart;
