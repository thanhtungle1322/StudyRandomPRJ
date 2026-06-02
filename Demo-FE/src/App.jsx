import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import NotificationBell from './components/NotificationBell';
import InvitationToast from './components/InvitationToast';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ProfilePage from './pages/ProfilePage';
import LobbyPage from './pages/LobbyPage';
import StudyRoom from './pages/StudyRoom';
import WhiteboardPage from './pages/WhiteboardPage';
import FriendsPage from './pages/FriendsPage';
import ReportPage from './pages/ReportPage';
import LeaderboardPage from './pages/LeaderboardPage';
import PricingPage from './pages/PricingPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import FeedbackPage from './pages/FeedbackPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import StatisticsPage from './pages/StatisticsPage';
import { FiExternalLink, FiX } from 'react-icons/fi';
import { getSocket } from './services/socket';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
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
    
    // Check local storage updates periodically to support immediate rendering when leaving
    const interval = setInterval(checkSession, 1500);
    
    window.addEventListener('storage', checkSession);
    return () => {
      window.removeEventListener('storage', checkSession);
      clearInterval(interval);
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
    <div 
      className="floating-session-widget animate-fade-in-up" 
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: 'rgba(15, 15, 20, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(132, 94, 247, 0.4)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 16px rgba(132, 94, 247, 0.2)',
        borderRadius: '16px',
        padding: '16px',
        width: '320px',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span 
            className="pulse-icon" 
            style={{ 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              background: '#51cf66', 
              display: 'inline-block',
              boxShadow: '0 0 8px #51cf66'
            }} 
          />
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#845ef7' }}>
            Phiên học đang chạy
          </h4>
        </div>
        <button 
          onClick={handleCancelSession}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#adb5bd', 
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
          title="Hủy phiên"
        >
          <FiX size={16} />
        </button>
      </div>

      <div style={{ fontSize: '13px', opacity: 0.9, lineHeight: '1.4' }}>
        Bạn có một phòng học đang hoạt động! Bạn có muốn quay lại không?
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <Link 
          to={`/room/${activeSession.roomId}`}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg, #845ef7, #5c7cfa)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(132, 94, 247, 0.2)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
        >
          <FiExternalLink size={14} /> Quay lại phòng
        </Link>
      </div>
    </div>
  );
}

function App() {
  const { isLoggedIn } = useAuth();
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
    
    // Check local storage updates periodically to support immediate rendering when leaving
    const interval = setInterval(checkSession, 1000);
    
    window.addEventListener('storage', checkSession);
    return () => {
      window.removeEventListener('storage', checkSession);
      clearInterval(interval);
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
          <StudyRoom propRoomId={activeRoomId} />
        </div>
      )}

      <main style={{ flex: 1, display: isAtRoom ? 'none' : 'block' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={isLoggedIn ? <Navigate to="/lobby" replace /> : <LoginPage />}
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
      </main>
    </>
  );
}

export default App;
