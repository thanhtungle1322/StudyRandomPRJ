import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🎓</span>
          <span className="brand-text">
            Study<span className="brand-highlight">Random</span>
          </span>
        </Link>

        <div className="navbar-links">
          {isLoggedIn ? (
            <>
              <Link to="/lobby" className="nav-link">
                <span className="nav-icon">🏠</span>
                Sảnh chờ
              </Link>
              <Link to="/whiteboard" className="nav-link">
                <span className="nav-icon">📋</span>
                Bảng trắng
              </Link>
              <Link to="/friends" className="nav-link">
                <span className="nav-icon">👥</span>
                Bạn bè
              </Link>
              <div className="navbar-user">
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                  alt="Avatar"
                  className="user-avatar"
                />
                <span className="user-name">{user?.username}</span>
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
