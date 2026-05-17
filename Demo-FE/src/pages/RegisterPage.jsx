import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FaGraduationCap } from 'react-icons/fa';
import { FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import './LoginPage.css';

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!displayName.trim() || displayName.trim().length < 2) {
      setError('Tên hiển thị phải có ít nhất 2 ký tự');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Email không hợp lệ');
      return;
    }
    if (!password || password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/register', {
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      if (data.success) {
        login(data.user, data.token);
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
            <div className="login-icon"><FaGraduationCap style={{ color: '#845ef7' }} /></div>
            <h1>Đăng Ký StudyRandom</h1>
            <p>Tạo tài khoản để bắt đầu tìm bạn học</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="displayName">Tên hiển thị</label>
              <input
                id="displayName"
                type="text"
                className="input-field"
                placeholder="Tên hiển thị khi vào phòng học..."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
              />
            </div>

            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Mật khẩu</label>
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="Ít nhất 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="login-error">
                <span><FiAlertTriangle style={{ color: '#ff6b6b' }} /></span> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg login-btn"
              disabled={loading || !displayName.trim() || !email.trim() || !password}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Đang đăng ký...
                </>
              ) : (
                <>
                  <span><FiArrowRight style={{ color: '#fcc419' }} /></span>
                  Đăng Ký
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
