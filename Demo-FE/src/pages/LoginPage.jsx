import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './LoginPage.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 2) {
      setError('Tên phải có ít nhất 2 ký tự');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { username: username.trim() });
      if (data.success) {
        login(data.user);
        navigate('/lobby');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
      </div>

      <div className="login-container animate-fade-in">
        <div className="login-card glass-card">
          <div className="login-header">
            <div className="login-icon">🎓</div>
            <h1>Chào mừng đến StudyRandom</h1>
            <p>Nhập tên để bắt đầu tìm bạn học</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="username">Tên hiển thị</label>
              <input
                id="username"
                type="text"
                className="input-field"
                placeholder="Nhập tên của bạn..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                maxLength={30}
              />
            </div>

            {error && (
              <div className="login-error">
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg login-btn"
              disabled={loading || !username.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Vào Ngay
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>Không cần email hay mật khẩu — chỉ cần một cái tên là đủ!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
