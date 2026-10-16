import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../services/api';

const Login = () => {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = isRegister
        ? await register(email, password, playerName)
        : await login(email, password);

      localStorage.setItem('token', res.token);
      localStorage.setItem('player', JSON.stringify(res.player));
      navigate('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-rise">
          <span className="eyebrow inline-block rounded-full bg-white/[0.04] px-3 py-1 ring-1 ring-white/10">Track your game · shot by shot</span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Shots Gained</h1>
        </div>

        <form onSubmit={handleSubmit} className="card p-5 space-y-3 animate-rise [animation-delay:80ms]">
          {isRegister && (
            <input
              type="text"
              placeholder="Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              required
              className="w-full"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full"
          />

          {error && (
            <p className="text-sg-negative text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary"
          >
            {loading ? '...' : isRegister ? 'Create Account' : 'Login'}
          </button>
        </form>

        <button
          onClick={() => { setIsRegister(!isRegister); setError(''); }}
          className="w-full btn-ghost justify-center mt-4"
        >
          {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
        </button>
      </div>
    </div>
  );
};

export default Login;
