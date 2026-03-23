import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RoundSetup from './pages/RoundSetup';
import ShotEntry from './pages/ShotEntry';
import RoundSummary from './pages/RoundSummary';
import RoundHistory from './pages/RoundHistory';
import RoundDetail from './pages/RoundDetail';

const App = () => {
  return (
    <div className="min-h-dvh">
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Dashboard />} />
        <Route path="/rounds" element={<RoundHistory />} />
        <Route path="/rounds/:roundId" element={<RoundDetail />} />
        <Route path="/round/setup" element={<RoundSetup />} />
        <Route path="/round/play" element={<ShotEntry />} />
        <Route path="/round/summary" element={<RoundSummary />} />
      </Routes>
    </div>
  );
};

export default App;
