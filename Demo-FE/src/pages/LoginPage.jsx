import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FaGraduationCap, FaGoogle } from 'react-icons/fa';
import { FiAlertTriangle, FiLock } from 'react-icons/fi';
import './LoginPage.css';

import bgLogin from '/background/backgroundLogin.png';
import mascot1 from '/background/mascot1.png';
import mascot2 from '/background/mascot2.png';
import mascot3 from '/background/mascot3.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập email hợp lệ');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', {
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

  const handleGoogleLogin = () => {
    const baseUrl = API_URL.replace('/api', '');
    window.location.href = `${baseUrl}/api/auth/google`;
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <img src={bgLogin} alt="" className="login-bg-img" />
      </div>

      <img src={mascot1} alt="" className="login-mascot login-mascot-1" />
      <img src={mascot2} alt="" className="login-mascot login-mascot-2" />
      <img src={mascot3} alt="" className="login-mascot login-mascot-3" />

      <div className="login-container animate-fade-in">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon"><FaGraduationCap style={{ color: '#845ef7' }} /></div>
            <p className="login-welcome">Chào mừng đến</p>
            <h1>StudyRandom</h1>
            <p>Đăng nhập để tiếp tục tìm bạn học</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Mật khẩu</label>
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="Nhập mật khẩu"
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
              disabled={loading || !email.trim() || !password}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <span><FiLock style={{ color: '#fcc419' }} /></span>
                  Đăng Nhập
                </>
              )}
            </button>

            <div className="login-divider">
              <span>hoặc</span>
            </div>

            <button
              type="button"
              className="btn btn-google btn-lg"
              onClick={handleGoogleLogin}
            >
              <span className="google-icon"><FaGoogle style={{ color: '#4285F4' }} /></span>
              Đăng nhập với Google
            </button>
          </form>

          <div className="login-footer">
            <p>
              Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
