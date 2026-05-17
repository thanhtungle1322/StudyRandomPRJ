import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { disconnectSocket } from '../services/socket';
import api from '../services/api';
import { FaGraduationCap } from 'react-icons/fa';
import { FiHome, FiEdit3, FiUsers } from 'react-icons/fi';
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

  const avatarSrc = user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName}`;
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
          {isLoggedIn ? (
            <>
              <Link to="/lobby" className="nav-link">
                <span className="nav-icon"><FiHome style={{ color: '#339af0' }} /></span>
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
              <div className="navbar-user">
                <Link to="/profile" className="user-avatar-link" title="Hồ sơ cá nhân">
                  <img
                    src={avatarSrc}
                    alt="Avatar"
                    className="user-avatar"
                    onError={(e) => {
                      e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`;
                    }}
                  />
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
