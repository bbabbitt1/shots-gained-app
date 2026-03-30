import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
    <div className="min-h-dvh px-4 pt-6 pb-10 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analysis</h1>
        <button
          onClick={() => navigate('/home')}
          className="text-text-secondary text-sm py-2 min-h-[44px] hover:text-text-primary transition-colors"
        >
          Dashboard
        </button>
      </div>

      {/* Filter */}
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full bg-bg-card border border-border rounded-xl px-4 py-3 text-text-primary text-sm appearance-none cursor-pointer"
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
      <div className="flex bg-bg-card border border-border rounded-xl p-1 gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
              tab === t
                ? `${TAB_COLORS[t]} text-white`
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
        <div className="text-center py-16 space-y-2">
          <p className="text-text-secondary">No data for this filter</p>
          <p className="text-text-muted text-sm">Play some rounds to see your analysis</p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl p-4">
          {tab === 'Driving' && <DrivingChart shots={shots as never} />}
          {tab === 'Approach' && <ApproachChart shots={shots as never} />}
          {tab === 'Putting' && <PuttingChart shots={shots as never} />}
        </div>
      )}
    </div>
  );
};

export default Analysis;
