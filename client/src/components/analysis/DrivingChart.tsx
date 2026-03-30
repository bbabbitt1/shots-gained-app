import { useMemo } from 'react';
import { formatSG } from '@shared/sg-calculator';

interface AnalysisShot {
  Category: string;
  ClubUsed: string | null;
  StrokesGained: number;
  Penalty: boolean;
}

const DrivingChart = ({ shots }: { shots: AnalysisShot[] }) => {
  const drivingShots = useMemo(
    () => shots.filter((s) => s.Category === 'Driving'),
    [shots]
  );

  const clubData = useMemo(() => {
    const map = new Map<string, { sg: number; count: number; penalties: number }>();
    for (const s of drivingShots) {
      const club = s.ClubUsed || 'Unknown';
      const entry = map.get(club) || { sg: 0, count: 0, penalties: 0 };
      entry.sg += s.StrokesGained;
      entry.count += 1;
      if (s.Penalty) entry.penalties += 1;
      map.set(club, entry);
    }
    return [...map.entries()]
      .map(([club, data]) => ({ club, ...data, sg: Math.round(data.sg * 1000) / 1000 }))
      .sort((a, b) => b.sg - a.sg);
  }, [drivingShots]);

  const maxAbs = Math.max(...clubData.map((d) => Math.abs(d.sg)), 0.1);

  if (clubData.length === 0) {
    return <p className="text-text-muted text-center py-8">No driving data</p>;
  }

  return (
    <div className="space-y-3">
      <div className="text-text-secondary text-xs uppercase tracking-wider">
        SG by Club · {drivingShots.length} shots
      </div>
      {clubData.map(({ club, sg, count, penalties }) => {
        const pct = (Math.abs(sg) / maxAbs) * 45;
        const barColor = sg >= 0 ? 'bg-sg-positive' : 'bg-sg-negative';
        const textColor = sg > 0 ? 'text-sg-positive' : sg < 0 ? 'text-sg-negative' : 'text-sg-neutral';
        return (
          <div key={club}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2">
                <span className="text-text-primary font-medium">{club}</span>
                <span className="text-text-muted text-xs">({count})</span>
                {penalties > 0 && (
                  <span className="text-sg-negative text-xs font-semibold bg-sg-negative/15 px-1.5 py-0.5 rounded">
                    {penalties} pen
                  </span>
                )}
              </div>
              <span className={`font-semibold tabular-nums ${textColor}`}>{formatSG(sg)}</span>
            </div>
            <div className="h-3 bg-bg-surface rounded-full relative">
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
              <div
                className={`absolute top-0 bottom-0 rounded-full ${barColor} transition-all`}
                style={sg >= 0
                  ? { left: '50%', width: `${pct}%` }
                  : { right: '50%', width: `${pct}%` }
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DrivingChart;
