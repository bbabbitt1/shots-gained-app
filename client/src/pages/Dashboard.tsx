import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayerStats } from '../services/api';
import { getPendingRounds } from '../services/offline';
import { syncPendingRounds } from '../services/sync';
import { formatSG } from '@shared/sg-calculator';

interface Stats {
  rounds: number;
  holes: number;
  totalStrokes: number;
  totalPar: number;
  avgSGPerHole: number;
  sgDriving: number;
  sgApproach: number;
  sgShortGame: number;
  sgPutting: number;
  girHit: number;
  firTotal: number;
  firHit: number;
  udTotal: number;
  udHit: number;
  totalPutts: number;
}

interface RecentRound {
  RoundID: number;
  RoundDate: string;
  HolesPlayed: number;
  ClubName: string;
  totalScore: number;
  totalPar: number;
  totalSG: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const player = JSON.parse(localStorage.getItem('player') || '{}');

  const loadData = () => {
    getPlayerStats()
      .then((data) => {
        setStats(data.stats);
        setRecent(data.recentRounds || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    getPendingRounds().then((p) => setPendingCount(p.length));
  };

  useEffect(() => {
    loadData();
    // Auto-sync pending rounds
    getPendingRounds().then(async (pending) => {
      if (pending.length > 0 && navigator.onLine) {
        setSyncing(true);
        const result = await syncPendingRounds();
        setSyncing(false);
        if (result.synced > 0) loadData(); // refresh stats
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sgColor = (v: number) => v > 0 ? 'text-sg-positive' : v < 0 ? 'text-sg-negative' : 'text-sg-neutral';
  const scoreColor = (v: number) => v < 0 ? 'text-sg-positive' : v > 0 ? 'text-sg-negative' : 'text-text-primary';

  const pct = (hit: number, total: number) => total > 0 ? `${Math.round((hit / total) * 100)}%` : '—';

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const hasData = stats && stats.rounds > 0;

  return (
    <div className="min-h-dvh px-4 pt-6 pb-24 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hey, {player.playerName?.split(' ')[0] || 'Golfer'}</h1>
          <p className="text-text-muted text-sm">
            {hasData ? `${stats.rounds} round${stats.rounds > 1 ? 's' : ''} tracked` : 'Ready to track your game?'}
          </p>
        </div>
        <button
          onClick={() => navigate('/rounds')}
          className="text-text-secondary text-sm hover:text-text-primary transition-colors"
        >
          All Rounds
        </button>
      </div>

      {/* Pending sync banner */}
      {pendingCount > 0 && (
        <div className="bg-cat-driving/15 border border-cat-driving/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-cat-driving text-sm font-medium">
            {syncing ? 'Syncing...' : `${pendingCount} round${pendingCount > 1 ? 's' : ''} saved offline`}
          </span>
          {!syncing && navigator.onLine && (
            <button
              onClick={async () => {
                setSyncing(true);
                await syncPendingRounds();
                setSyncing(false);
                loadData();
              }}
              className="text-cat-driving text-xs font-semibold hover:underline"
            >
              Sync now
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-text-secondary text-center py-12">Loading...</p>
      ) : !hasData ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-text-secondary text-lg">No rounds logged yet</p>
          <p className="text-text-muted text-sm">Start tracking to see your stats here</p>
        </div>
      ) : (
        <>
          {/* SG Overview */}
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">Shots Gained (All Rounds)</div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {([
                { label: 'DRV', val: stats.sgDriving },
                { label: 'APP', val: stats.sgApproach },
                { label: 'SG', val: stats.sgShortGame },
                { label: 'PUT', val: stats.sgPutting },
              ] as const).map(({ label, val }) => (
                <div key={label} className="bg-accent/10 rounded-lg p-2 text-center">
                  <div className="text-[10px] font-semibold text-accent uppercase tracking-wider">{label}</div>
                  <div className={`text-sm font-bold ${sgColor(val)}`}>{formatSG(val)}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-text-muted text-xs">Avg SG / hole</span>
              <span className={`font-bold ${sgColor(stats.avgSGPerHole)}`}>{formatSG(stats.avgSGPerHole)}</span>
            </div>
          </div>

          {/* Key Stats */}
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">Stats</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-surface rounded-lg p-3 text-center">
                <div className="text-text-muted text-[10px] uppercase tracking-wider">Scoring Avg</div>
                <div className="text-xl font-bold text-text-primary">
                  {(stats.totalStrokes / stats.rounds).toFixed(1)}
                </div>
                <div className="text-text-muted text-xs">{stats.holes} holes</div>
              </div>
              <div className="bg-bg-surface rounded-lg p-3 text-center">
                <div className="text-text-muted text-[10px] uppercase tracking-wider">Avg Putts</div>
                <div className="text-xl font-bold text-text-primary">
                  {(stats.totalPutts / stats.rounds).toFixed(1)}
                </div>
                <div className="text-text-muted text-xs">per round</div>
              </div>
              <div className="bg-bg-surface rounded-lg p-3 text-center">
                <div className="text-text-muted text-[10px] uppercase tracking-wider">FIR</div>
                <div className="text-xl font-bold text-text-primary">{pct(stats.firHit, stats.firTotal)}</div>
                <div className="text-text-muted text-xs">{stats.firHit}/{stats.firTotal}</div>
              </div>
              <div className="bg-bg-surface rounded-lg p-3 text-center">
                <div className="text-text-muted text-[10px] uppercase tracking-wider">GIR</div>
                <div className="text-xl font-bold text-text-primary">{pct(stats.girHit, stats.holes)}</div>
                <div className="text-text-muted text-xs">{stats.girHit}/{stats.holes}</div>
              </div>
            </div>
          </div>

          {/* Recent Rounds */}
          {recent.length > 0 && (
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-text-secondary text-xs uppercase tracking-wider">Recent Rounds</div>
                <button onClick={() => navigate('/rounds')} className="text-accent text-xs hover:underline">
                  View all
                </button>
              </div>
              <div className="space-y-2">
                {recent.map((r) => {
                  const stp = (r.totalScore || 0) - (r.totalPar || 0);
                  return (
                    <button
                      key={r.RoundID}
                      onClick={() => navigate(`/rounds/${r.RoundID}`)}
                      className="w-full flex items-center justify-between py-2 border-b border-border/30 last:border-0 hover:bg-bg-surface/50 -mx-1 px-1 rounded transition-colors"
                    >
                      <div className="text-left">
                        <div className="text-text-primary text-sm font-medium">{r.ClubName}</div>
                        <div className="text-text-muted text-xs">{formatDate(r.RoundDate)} · {r.HolesPlayed}h</div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        {r.totalScore && (
                          <span className={`text-sm font-semibold ${scoreColor(stp)}`}>
                            {stp === 0 ? 'E' : stp > 0 ? `+${stp}` : stp}
                          </span>
                        )}
                        {r.totalSG !== null && (
                          <span className={`text-sm font-bold ${sgColor(r.totalSG)}`}>
                            {formatSG(r.totalSG)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => navigate('/round/setup')}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-4 rounded-xl transition-colors text-lg shadow-lg shadow-black/30"
          >
            Log Round
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
