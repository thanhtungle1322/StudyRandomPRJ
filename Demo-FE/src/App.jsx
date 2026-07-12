import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './context/auth-context';
import Navbar from './components/Navbar';
import InvitationToast from './components/InvitationToast';
import HomePage from './pages/HomePage';
import { FiExternalLink, FiLoader, FiX } from 'react-icons/fi';
import { getSocket } from './services/socket';
import { setupAnalytics, logPageView } from './services/analytics';
import './App.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LobbyPage = lazy(() => import('./pages/LobbyPage'));
const StudyRoom = lazy(() => import('./pages/StudyRoom'));
const WhiteboardPage = lazy(() => import('./pages/WhiteboardPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'));

function PageLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <FiLoader className="route-loading-icon" aria-hidden="true" />
      <span>Đang tải...</span>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isLoggedIn, authReady } = useAuth();
  if (!authReady) return <PageLoading />;
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function FloatingSessionWidget() {
  const location = useLocation();
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    const checkSession = () => {
      try {
        const sessionStr = localStorage.getItem('activeStudySession');
        if (sessionStr) {
          setActiveSession(JSON.parse(sessionStr));
        } else {
          setActiveSession(null);
        }
      } catch (e) {
        console.error(e);
      }
    };

    checkSession();
    
    window.addEventListener('storage', checkSession);
    return () => {
      window.removeEventListener('storage', checkSession);
    };
  }, [location.pathname]);

  if (!activeSession || location.pathname.startsWith('/room/')) {
    return null;
  }

  const handleCancelSession = () => {
    if (window.confirm('Bạn có chắc muốn hủy kết nối với phòng học cũ? Bạn học của bạn sẽ được thông báo.')) {
      const sessionStr = localStorage.getItem('activeStudySession');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          const socket = getSocket();
          if (socket && session.roomId) {
            socket.emit('leave_room', { roomId: session.roomId });
          }
        } catch (e) {
          console.error('[Session cancel] Failed to emit leave_room:', e);
        }
      }
      localStorage.removeItem('activeStudySession');
      setActiveSession(null);
    }
  };

  return (
    <aside className="floating-session-widget animate-fade-in-up" aria-label="Phiên học đang hoạt động">
      <div className="floating-session-header">
        <div className="floating-session-heading">
          <span className="floating-session-dot" aria-hidden="true" />
          <h4>
            Phiên học đang chạy
          </h4>
        </div>
        <button 
          onClick={handleCancelSession}
          className="floating-session-close"
          title="Hủy phiên"
          aria-label="Hủy phiên học"
        >
          <FiX size={16} />
        </button>
      </div>

      <p className="floating-session-copy">
        Bạn có một phòng học đang hoạt động! Bạn có muốn quay lại không?
      </p>

      <div className="floating-session-actions">
        <Link 
          to={`/room/${activeSession.roomId}`}
          className="floating-session-return"
        >
          <FiExternalLink size={14} /> Quay lại phòng
        </Link>
      </div>
    </aside>
  );
}

function App() {
  const { isLoggedIn, authReady } = useAuth();
  const location = useLocation();
  const [activeSession, setActiveSession] = useState(null);

  // Initialize Google Analytics on mount
  useEffect(() => {
    setupAnalytics();
  }, []);

  // Track page view on route changes
  useEffect(() => {
    logPageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const checkSession = () => {
      try {
        const sessionStr = localStorage.getItem('activeStudySession');
        if (sessionStr) {
          setActiveSession(JSON.parse(sessionStr));
        } else {
          setActiveSession(null);
        }
      } catch (e) {
        console.error(e);
      }
    };

    checkSession();
    
    window.addEventListener('storage', checkSession);
    return () => {
      window.removeEventListener('storage', checkSession);
    };
  }, []);

  const isAtRoom = location.pathname.startsWith('/room/');
  const currentRoomId = location.pathname.split('/room/')[1];
  const activeRoomId = currentRoomId || activeSession?.roomId;

  return (
    <>
      <Navbar />
      <InvitationToast />
      <FloatingSessionWidget />
      
      {/* Global Persistent StudyRoom container */}
      {isLoggedIn && activeRoomId && (
        <div style={{ display: isAtRoom ? 'block' : 'none' }}>
          <Suspense fallback={<PageLoading />}>
            <StudyRoom propRoomId={activeRoomId} />
          </Suspense>
        </div>
      )}

      <main style={{ flex: 1, display: isAtRoom ? 'none' : 'block' }}>
        <Suspense fallback={<PageLoading />}>
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={!authReady ? null : (isLoggedIn ? <Navigate to="/lobby" replace /> : <LoginPage />)}
          />
          <Route
            path="/register"
            element={isLoggedIn ? <Navigate to="/lobby" replace /> : <RegisterPage />}
          />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
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
                <div className="room-route-placeholder" style={{ minHeight: '100vh', background: '#0c0e17' }} />
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
          <Route
            path="/feedback"
            element={
              <ProtectedRoute>
                <FeedbackPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatisticsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/pricing" element={<PricingPage />} />
          <Route
            path="/payment-success"
            element={
              <ProtectedRoute>
                <PaymentSuccessPage />
              </ProtectedRoute>
            }
          />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}

export default App;
