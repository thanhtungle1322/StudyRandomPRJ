import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { disconnectSocket } from '../services/socket';
import api from '../services/api';
import { FaGraduationCap } from 'react-icons/fa';
import { FiHome, FiEdit3, FiUsers, FiBarChart2, FiShield } from 'react-icons/fi';
import './Navbar.css';

export default function Navbar() {
  const { user, logout, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    disconnectSocket();
    logout();
    navigate('/');
  };

  const getDecorClasses = (user) => {
    if (!user || !user.badges) return { wrapper: '', overlay: '' };
    if (user.badges.includes('PREMIUM_ULTIMATE')) {
      return { wrapper: 'has-decor-ultimate', overlay: 'decor-ultimate' };
    }
    if (user.badges.includes('PREMIUM_PRO')) {
      return { wrapper: 'has-decor-pro', overlay: 'decor-pro' };
    }
    if (user.badges.includes('PREMIUM_STARTER')) {
      return { wrapper: 'has-decor-starter', overlay: 'decor-starter' };
    }
    return { wrapper: '', overlay: '' };
  };

  const decors = getDecorClasses(user);
  const avatarSrc = user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || 'guest'}`;
  const displayName = user?.displayName || '';

  return (
    <nav className="navbar">
      <div className="navbar-inner container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon"><FaGraduationCap style={{ color: '#845ef7' }} /></span>
          <span className="brand-text">
            Study<span className="brand-highlight">Random</span>
          </span>
        </Link>

        <div className="navbar-links">
          {/* Nút Trang chủ luôn hiển thị */}
          <Link to="/" className="nav-link">
            <span className="nav-icon"><FiHome style={{ color: '#f783ac' }} /></span>
            Trang chủ
          </Link>

          {isLoggedIn ? (
            <>
              {user?.role === 'admin' && (
                <Link to="/admin" className="nav-link nav-link-admin" style={{ fontWeight: 'bold' }}>
                  <span className="nav-icon"><FiShield style={{ color: '#ff6b6b' }} /></span>
                  Admin
                </Link>
              )}
              <Link to="/lobby" className="nav-link">
                <span className="nav-icon"><FiBarChart2 style={{ color: '#339af0' }} /></span>
                Sảnh chờ
              </Link>
              <Link to="/whiteboard" className="nav-link">
                <span className="nav-icon"><FiEdit3 style={{ color: '#845ef7' }} /></span>
                Bảng trắng
              </Link>
              <Link to="/friends" className="nav-link">
                <span className="nav-icon"><FiUsers style={{ color: '#20c997' }} /></span>
                Bạn bè
              </Link>
              <Link to="/leaderboard" className="nav-link">
                <span className="nav-icon">🏆</span>
                Xếp hạng
              </Link>
              <Link to="/feedback" className="nav-link">
                <span className="nav-icon">💬</span>
                Đánh giá
              </Link>
              <Link to="/pricing" className="nav-link nav-link-premium">
                <span className="nav-icon">⭐</span>
                Premium
              </Link>
              <div className="navbar-user">
                <Link to="/profile" className="user-avatar-link" title="Hồ sơ cá nhân" style={{ overflow: 'visible' }}>
                  <div className={`avatar-decor-wrapper ${decors.wrapper}`} style={{ width: '32px', height: '32px' }}>
                    <img
                      src={avatarSrc}
                      alt="Avatar"
                      className="user-avatar avatar-decor-img"
                      onError={(e) => {
                        e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;
                      }}
                    />
                    {decors.overlay && <div className={`avatar-decor-overlay ${decors.overlay}`}></div>}
                  </div>
                </Link>
                <span className="user-name">{displayName}</span>
                <button onClick={handleLogout} className="btn btn-sm btn-secondary">
                  Đăng xuất
                </button>
              </div>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
