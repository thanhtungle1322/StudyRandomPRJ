import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import StudyRoom from './pages/StudyRoom';
import WhiteboardPage from './pages/WhiteboardPage';
import FriendsPage from './pages/FriendsPage';
import ReportPage from './pages/ReportPage';
import LeaderboardPage from './pages/LeaderboardPage';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const { isLoggedIn } = useAuth();

  return (
    <>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={isLoggedIn ? <Navigate to="/lobby" replace /> : <LoginPage />}
          />
          <Route
            path="/lobby"
            element={
              <ProtectedRoute>
                <LobbyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/room/:roomId"
            element={
              <ProtectedRoute>
                <StudyRoom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/whiteboard"
            element={
              <ProtectedRoute>
                <WhiteboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <FriendsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report"
            element={
              <ProtectedRoute>
                <ReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <LeaderboardPage />
              </ProtectedRoute>
            }
          />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
