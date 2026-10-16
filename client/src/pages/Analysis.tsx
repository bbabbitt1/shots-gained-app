import { useState, useEffect, useMemo } from 'react';
import { getAnalysisShots } from '../services/api';
import DrivingChart from '../components/analysis/DrivingChart';
import ApproachChart from '../components/analysis/ApproachChart';
import PuttingChart from '../components/analysis/PuttingChart';

type Tab = 'Driving' | 'Approach' | 'Putting';

interface RoundOption {
  RoundID: number;
  RoundDate: string;
  HolesPlayed: number;
  ClubName: string;
}

const TABS: Tab[] = ['Driving', 'Approach', 'Putting'];
const TAB_COLORS: Record<Tab, string> = {
  Driving: 'bg-cat-driving',
  Approach: 'bg-cat-approach',
  Putting: 'bg-cat-putting',
};

const Analysis = () => {
  const [tab, setTab] = useState<Tab>('Driving');
  const [filter, setFilter] = useState('all');
  const [shots, setShots] = useState<Record<string, unknown>[]>([]);
  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAnalysisShots(filter)
      .then((data) => {
        setShots(data.shots);
        setRounds(data.rounds);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Summary stats for header
  const categorySG = useMemo(() => {
    const result = { Driving: 0, Approach: 0, Putting: 0 };
    for (const s of shots) {
      const cat = s.Category as Tab;
      if (cat in result) result[cat] += s.StrokesGained as number;
    }
    for (const k of Object.keys(result) as Tab[]) {
      result[k] = Math.round(result[k] * 1000) / 1000;
    }
    return result;
  }, [shots]);

  return (
    <div className="min-h-dvh px-4 pt-8 pb-32 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <h1 className="text-3xl font-semibold tracking-tight">Analysis</h1>

      {/* Filter */}
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full appearance-none cursor-pointer"
      >
        <option value="all">All Rounds</option>
        <option value="last5">Last 5 Rounds</option>
        <option value="last10">Last 10 Rounds</option>
        {rounds.map((r) => (
          <option key={r.RoundID} value={`round:${r.RoundID}`}>
            {formatDate(r.RoundDate)} — {r.ClubName} ({r.HolesPlayed}h)
          </option>
        ))}
      </select>

      {/* Category Tabs */}
      <div className="flex rounded-full bg-bg-surface/70 ring-1 ring-white/10 p-1 gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 min-h-[44px] text-sm font-semibold rounded-full transition-colors duration-200 ease-spring ${
              tab === t
                ? `${TAB_COLORS[t]} text-bg-primary`
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-text-secondary text-center py-12">Loading...</p>
      ) : shots.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <p className="text-text-secondary">No data for this filter</p>
          <p className="text-text-muted text-sm">Play some rounds to see your analysis</p>
        </div>
      ) : (
        <div className="card p-4">
          {tab === 'Driving' && <DrivingChart shots={shots as never} />}
          {tab === 'Approach' && <ApproachChart shots={shots as never} />}
          {tab === 'Putting' && <PuttingChart shots={shots as never} />}
        </div>
      )}
    </div>
  );
};

export default Analysis;
