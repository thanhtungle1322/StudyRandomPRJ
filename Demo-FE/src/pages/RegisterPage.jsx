import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import api from '../services/api';
import { FaGraduationCap } from 'react-icons/fa';
import { FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import './LoginPage.css';

import bgLogin from '../../background/backgroundLogin.webp';
import mascot1 from '../../background/mascot1.png';
import mascot2 from '../../background/mascot2.png';
import mascot3 from '../../background/mascot3.png';

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const passwordRef = useRef(null);

  // Xóa password field khi component unmount
  // → ngăn Chrome detect 'password đã dùng' khi navigate đi
  useEffect(() => {
    const passwordInput = passwordRef.current;
    return () => {
      if (passwordInput) {
        passwordInput.value = '';
      }
    };
  }, []);

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
            <p>Tạo tài khoản để bắt đầu tìm bạn học</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
            <div className="input-group">
              <label htmlFor="reg-displayName">Tên hiển thị</label>
              <input
                id="reg-displayName"
                type="text"
                name="displayName"
                autoComplete="nickname"
                className="input-field"
                placeholder="Tên hiển thị khi vào phòng học..."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
              />
            </div>

            <div className="input-group">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                name="email"
                autoComplete="email"
                className="input-field"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="reg-password">Mật khẩu</label>
              <input
                ref={passwordRef}
                id="reg-password"
                type="password"
                name="new-password"
                autoComplete="new-password"
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
                  <span className="app-spinner" aria-hidden="true"></span>
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
              Đã có tài khoản?{' '}
              <Link
                to="/login"
                onClick={() => {
                  if (passwordRef.current) passwordRef.current.value = '';
                  setPassword('');
                  setEmail('');
                  setDisplayName('');
                }}
              >
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
