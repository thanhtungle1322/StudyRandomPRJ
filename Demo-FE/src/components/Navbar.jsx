import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { disconnectSocket } from '../services/socket';
import api from '../services/api';
import NotificationBell from './NotificationBell';
import { FaGraduationCap } from 'react-icons/fa';
import { FiHome, FiEdit3, FiUsers, FiBarChart2, FiShield, FiAward, FiStar, FiMessageSquare, FiLogOut } from 'react-icons/fi';
import './Navbar.css';

export default function Navbar() {
  const { user, logout, isLoggedIn, authReady } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.warn('[Navbar] Server logout failed; clearing local session.', error);
    }
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
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><FiHome style={{ color: '#f783ac' }} /></span>
            Trang chủ
          </NavLink>

          {!authReady ? (
            <span className="navbar-auth-placeholder" aria-hidden="true" />
          ) : isLoggedIn ? (
            <>
              {user?.role === 'admin' && (
                <NavLink to="/admin" className={({ isActive }) => `nav-link nav-link-admin ${isActive ? 'active' : ''}`}>
                  <span className="nav-icon"><FiShield style={{ color: '#ff6b6b' }} /></span>
                  Admin
                </NavLink>
              )}
              <NavLink to="/lobby" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="nav-icon"><FiBarChart2 style={{ color: '#339af0' }} /></span>
                Sảnh chờ
              </NavLink>
              <NavLink to="/friends" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="nav-icon"><FiUsers style={{ color: '#20c997' }} /></span>
                Bạn bè
              </NavLink>
              <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="nav-icon"><FiAward style={{ color: '#f59f00' }} /></span>
                Xếp hạng
              </NavLink>
              <NavLink to="/feedback" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="nav-icon"><FiMessageSquare style={{ color: '#4dabf7' }} /></span>
                Đánh giá
              </NavLink>
              <NavLink to="/pricing" className={({ isActive }) => `nav-link nav-link-premium ${isActive ? 'active' : ''}`}>
                <span className="nav-icon"><FiStar /></span>
                Premium
              </NavLink>
              <NotificationBell />
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
                <button
                  onClick={handleLogout}
                  className="navbar-logout-btn"
                  aria-label="Đăng xuất"
                  title="Đăng xuất"
                >
                  <FiLogOut />
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
