import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayerStats, clearSession } from '../services/api';
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
    <div className="min-h-dvh px-4 pt-8 pb-32 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between animate-rise">
        <div>
          <span className="eyebrow inline-block rounded-full bg-white/[0.04] px-3 py-1 ring-1 ring-white/10">Shots Gained</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Hey, {player.playerName?.split(' ')[0] || 'Golfer'}</h1>
          <p className="text-text-muted text-sm">
            {hasData ? `${stats.rounds} round${stats.rounds > 1 ? 's' : ''} tracked` : 'Ready to track your game?'}
          </p>
        </div>
        <button
          onClick={() => {
            clearSession();
            navigate('/login');
          }}
          className="btn-ghost -mr-3 hover:!text-sg-negative"
        >
          Logout
        </button>
      </div>

      {/* Pending sync banner */}
      {pendingCount > 0 && (
        <div className="bg-cat-driving/15 ring-1 ring-cat-driving/30 rounded-2xl pl-4 pr-1 py-1 flex items-center justify-between">
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
              className="btn-ghost text-cat-driving font-semibold hover:!text-cat-driving"
            >
              Sync now
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-text-secondary text-center py-12">Loading...</p>
      ) : !hasData ? (
        <div className="card p-8 text-center space-y-2 animate-rise">
          <p className="text-text-primary text-lg font-medium">No rounds logged yet</p>
          <p className="text-text-muted text-sm">Tap Log below to start tracking your first round</p>
        </div>
      ) : (
        <>
          {/* SG bento: hero + category tiles */}
          <div className="card p-5 animate-rise [animation-delay:60ms]">
            <div className="eyebrow">Avg SG / hole · all rounds</div>
            <div className={`num mt-1 text-5xl font-semibold ${sgColor(stats.avgSGPerHole)}`}>{formatSG(stats.avgSGPerHole)}</div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {([
                { label: 'Driving', val: stats.sgDriving, dot: 'bg-cat-driving' },
                { label: 'Approach', val: stats.sgApproach, dot: 'bg-cat-approach' },
                { label: 'Short Game', val: stats.sgShortGame, dot: 'bg-cat-shortgame' },
                { label: 'Putting', val: stats.sgPutting, dot: 'bg-cat-putting' },
              ] as const).map(({ label, val, dot }) => (
                <div key={label} className="tile p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    {label}
                  </div>
                  <div className={`num mt-1 text-xl font-semibold ${sgColor(val)}`}>{formatSG(val)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Stats */}
          <div className="card p-4 animate-rise [animation-delay:120ms]">
            <div className="eyebrow mb-3">Stats</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="tile p-3 text-center">
                <div className="eyebrow">Scoring Avg</div>
                <div className="num text-2xl font-semibold text-text-primary">
                  {(stats.totalStrokes / stats.rounds).toFixed(1)}
                </div>
                <div className="text-text-muted text-xs">{stats.holes} holes</div>
              </div>
              <div className="tile p-3 text-center">
                <div className="eyebrow">Avg Putts</div>
                <div className="num text-2xl font-semibold text-text-primary">
                  {(stats.totalPutts / stats.rounds).toFixed(1)}
                </div>
                <div className="text-text-muted text-xs">per round</div>
              </div>
              <div className="tile p-3 text-center">
                <div className="eyebrow">FIR</div>
                <div className="num text-2xl font-semibold text-text-primary">{pct(stats.firHit, stats.firTotal)}</div>
                <div className="text-text-muted text-xs">{stats.firHit}/{stats.firTotal}</div>
              </div>
              <div className="tile p-3 text-center">
                <div className="eyebrow">GIR</div>
                <div className="num text-2xl font-semibold text-text-primary">{pct(stats.girHit, stats.holes)}</div>
                <div className="text-text-muted text-xs">{stats.girHit}/{stats.holes}</div>
              </div>
            </div>
          </div>

          {/* Recent Rounds */}
          {recent.length > 0 && (
            <div className="card p-4 animate-rise [animation-delay:180ms]">
              <div className="flex items-center justify-between mb-1">
                <div className="eyebrow">Recent Rounds</div>
                <button onClick={() => navigate('/rounds')} className="btn-ghost -mr-3 text-accent hover:!text-accent">
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
                      className="flex w-[calc(100%+1rem)] items-center justify-between min-h-[56px] py-2 border-b border-white/5 last:border-0 hover:bg-white/[0.03] -mx-2 px-2 rounded-xl transition-colors duration-200 ease-spring"
                    >
                      <div className="text-left">
                        <div className="text-text-primary text-sm font-medium">{r.ClubName}</div>
                        <div className="text-text-muted text-xs">{formatDate(r.RoundDate)} · {r.HolesPlayed}h</div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        {r.totalScore && (
                          <span className={`num text-sm font-semibold ${scoreColor(stp)}`}>
                            {stp === 0 ? 'E' : stp > 0 ? `+${stp}` : stp}
                          </span>
                        )}
                        {r.totalSG !== null && (
                          <span className={`num text-sm font-semibold ${sgColor(r.totalSG)}`}>
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
    </div>
  );
};

export default Dashboard;
