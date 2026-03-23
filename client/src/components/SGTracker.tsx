import type { SGByCategory, Shot } from '@shared/types';
import { formatSG } from '@shared/sg-calculator';

interface RoundStats {
  fairways: { hit: number; total: number };
  greens: { hit: number; total: number };
  upAndDowns: { converted: number; total: number };
  putts: number;
}

interface SGTrackerProps {
  sgByCategory: SGByCategory;
  totalSG: number;
  shots: Shot[];
}

const categoryConfig = [
  { key: 'Driving' as const, label: 'DRV' },
  { key: 'Approach' as const, label: 'APP' },
  { key: 'Short Game' as const, label: 'SG' },
  { key: 'Putting' as const, label: 'PUT' },
] as const;

const computeStats = (shots: Shot[]): RoundStats => {
  const stats: RoundStats = {
    fairways: { hit: 0, total: 0 },
    greens: { hit: 0, total: 0 },
    upAndDowns: { converted: 0, total: 0 },
    putts: 0,
  };

  // Group shots by hole
  const holes = new Map<number, Shot[]>();
  for (const s of shots) {
    const arr = holes.get(s.hole) || [];
    arr.push(s);
    holes.set(s.hole, arr);
  }

  for (const [, holeShots] of holes) {
    const par = holeShots[0]?.par || 4;

    // FIR — only par 4/5, check first shot result
    if (par >= 4 && holeShots.length > 0) {
      const teeShot = holeShots[0];
      if (teeShot.shotResult) {
        stats.fairways.total++;
        if (teeShot.shotResult === 'Hit Fairway' || teeShot.shotResult === 'Drive Green') {
          stats.fairways.hit++;
        }
      }
    }

    // GIR — check if any shot within regulation has GIR or Drive Green result
    const girEligible = par - 2; // shots to reach green in reg
    let madeGIR = false;
    for (let i = 0; i < Math.min(girEligible, holeShots.length); i++) {
      const result = holeShots[i].shotResult;
      if (result === 'GIR' || result === 'Drive Green') {
        madeGIR = true;
        break;
      }
    }
    // Also check if end surface is Green/Hole within regulation
    for (let i = 0; i < Math.min(girEligible, holeShots.length); i++) {
      if (holeShots[i].surfaceEnd === 'Green' || holeShots[i].surfaceEnd === 'Hole') {
        madeGIR = true;
        break;
      }
    }
    stats.greens.total++;
    if (madeGIR) stats.greens.hit++;

    // Up and Down — missed GIR, then got up and down (1 chip/pitch + 1 putt or chip-in)
    if (!madeGIR) {
      // Find first shot from around the green (short game category)
      const shortGameIdx = holeShots.findIndex((s) => s.category === 'Short Game');
      if (shortGameIdx >= 0) {
        stats.upAndDowns.total++;
        const remainingShots = holeShots.slice(shortGameIdx);
        // Up and down = 2 shots or fewer to hole out from short game position
        if (remainingShots.length <= 2) {
          const lastShot = remainingShots[remainingShots.length - 1];
          if (lastShot.surfaceEnd === 'Hole') {
            stats.upAndDowns.converted++;
          }
        }
      }
    }

    // Putts — count shots from Green
    for (const s of holeShots) {
      if (s.category === 'Putting') stats.putts++;
    }
  }

  return stats;
};

const SGTracker = ({ sgByCategory, totalSG, shots }: SGTrackerProps) => {
  const sgColor = (val: number) =>
    val > 0 ? 'text-sg-positive' : val < 0 ? 'text-sg-negative' : 'text-sg-neutral';

  const stats = computeStats(shots);

  return (
    <div className="bg-bg-card border border-border rounded-xl p-3 space-y-2">
      {/* SG Header */}
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-xs font-medium uppercase tracking-wider">Shots Gained</span>
        <span className={`text-lg font-bold ${sgColor(totalSG)}`}>{formatSG(totalSG)}</span>
      </div>

      {/* SG by Category */}
      <div className="grid grid-cols-4 gap-2">
        {categoryConfig.map(({ key, label }) => (
          <div key={key} className="bg-accent/10 rounded-lg p-2 text-center">
            <div className="text-[10px] font-semibold text-accent uppercase tracking-wider">{label}</div>
            <div className={`text-sm font-bold ${sgColor(sgByCategory[key])}`}>
              {formatSG(sgByCategory[key])}
            </div>
          </div>
        ))}
      </div>

      {/* Round Stats */}
      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-border/50">
        <div className="text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-wider">FIR</div>
          <div className="text-sm font-semibold text-text-primary">
            {stats.fairways.total > 0 ? `${stats.fairways.hit}/${stats.fairways.total}` : '—'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-wider">GIR</div>
          <div className="text-sm font-semibold text-text-primary">
            {stats.greens.total > 0 ? `${stats.greens.hit}/${stats.greens.total}` : '—'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-wider">↑/↓</div>
          <div className="text-sm font-semibold text-text-primary">
            {stats.upAndDowns.total > 0 ? `${stats.upAndDowns.converted}/${stats.upAndDowns.total}` : '—'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Putts</div>
          <div className="text-sm font-semibold text-text-primary">
            {stats.putts > 0 ? stats.putts : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SGTracker;
