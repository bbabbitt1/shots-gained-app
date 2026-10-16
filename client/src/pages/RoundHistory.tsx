import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRounds } from '../services/api';
import Icon from '../components/Icons';

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
    <div className="min-h-dvh px-4 pt-8 pb-32 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Rounds</h1>
        <button
          onClick={() => navigate('/round/setup')}
          className="btn-secondary min-h-[44px] px-4 text-sm text-accent bg-accent/10 ring-accent/30 hover:bg-accent/20"
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
        <div className="space-y-3">
          {rounds.map((r) => (
            <button
              key={r.RoundID}
              onClick={() => navigate(`/rounds/${r.RoundID}`)}
              className="group w-full card p-4 text-left transition-transform duration-300 ease-spring active:scale-[0.99]"
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
                <Icon name="chevronRight" className="w-4 h-4 ml-3 shrink-0 text-text-muted transition-transform duration-300 ease-spring group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoundHistory;
