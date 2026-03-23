import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRounds } from '../services/api';

interface RoundRow {
  RoundID: number;
  RoundDate: string;
  HolesPlayed: number;
  TeePreference: string;
  ClubName: string;
  CourseName: string;
}

const RoundHistory = () => {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRounds()
      .then(setRounds)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-dvh px-4 pt-6 pb-10 max-w-lg mx-auto space-y-4">
      <button onClick={() => navigate('/home')} className="text-text-secondary text-sm py-2 min-h-[44px] hover:text-text-primary transition-colors">
        ← Dashboard
      </button>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rounds</h1>
        <button
          onClick={() => navigate('/round/setup')}
          className="bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          New Round
        </button>
      </div>

      {loading ? (
        <p className="text-text-secondary text-center py-8">Loading...</p>
      ) : rounds.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-text-secondary">No rounds yet</p>
          <button
            onClick={() => navigate('/round/setup')}
            className="text-accent hover:underline text-sm py-2 min-h-[44px]"
          >
            Start your first round
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rounds.map((r) => (
            <button
              key={r.RoundID}
              onClick={() => navigate(`/rounds/${r.RoundID}`)}
              className="w-full bg-bg-card border border-border rounded-xl p-4 text-left hover:border-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-semibold">{r.ClubName}</div>
                  {r.CourseName && (
                    <div className="text-text-muted text-xs">{r.CourseName}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-text-secondary text-sm">{formatDate(r.RoundDate)}</div>
                  <div className="text-text-muted text-xs">
                    {r.HolesPlayed} holes · {r.TeePreference}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoundHistory;
