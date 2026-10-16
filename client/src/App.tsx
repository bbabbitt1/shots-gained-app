import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RoundSetup from './pages/RoundSetup';
import ShotEntry from './pages/ShotEntry';
import RoundSummary from './pages/RoundSummary';
import RoundHistory from './pages/RoundHistory';
import RoundDetail from './pages/RoundDetail';
import ResumeEntry from './pages/ResumeEntry';
import Analysis from './pages/Analysis';
import ProtectedRoute from './components/ProtectedRoute';
import NavIsland from './components/NavIsland';

// Shot entry (/round/*) and login keep the full screen
const NAV_PATHS = /^\/(home|rounds|analysis)(\/|$)/;

const App = () => {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh">
      {NAV_PATHS.test(pathname) && localStorage.getItem('token') && <NavIsland />}
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/rounds" element={<ProtectedRoute><RoundHistory /></ProtectedRoute>} />
        <Route path="/rounds/:roundId" element={<ProtectedRoute><RoundDetail /></ProtectedRoute>} />
        <Route path="/round/setup" element={<ProtectedRoute><RoundSetup /></ProtectedRoute>} />
        <Route path="/round/play" element={<ProtectedRoute><ShotEntry /></ProtectedRoute>} />
        <Route path="/round/resume/:roundId" element={<ProtectedRoute><ResumeEntry /></ProtectedRoute>} />
        <Route path="/round/summary" element={<ProtectedRoute><RoundSummary /></ProtectedRoute>} />
        <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
      </Routes>
    </div>
  );
};

export default App;
