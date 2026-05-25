import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

/**
 * Decode JWT payload (không cần verify vì server vừa tạo token)
 */
function parseJwtPayload(token) {
  try {
    const base64Payload = token.split('.')[1];
    const payload = atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export default function AuthCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double-processing in React 18 StrictMode
    if (processedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      navigate('/login?error=google_auth_failed', { replace: true });
      return;
    }

    processedRef.current = true;

    // Decode JWT payload trực tiếp — không cần gọi thêm API
    const payload = parseJwtPayload(token);

    if (!payload || !payload.userId) {
      console.error('[AuthCallback] Invalid JWT payload');
      navigate('/login?error=google_auth_failed', { replace: true });
      return;
    }

    const user = {
      id: payload.userId,
      displayName: payload.displayName,
      email: payload.email,
      avatar: payload.avatar,
    };

    // Lưu token + login + chuyển trang
    localStorage.setItem('studyrandom_token_v2', token);
    login(user, token);
    navigate('/lobby', { replace: true });
  }, [login, navigate]);

  return (
    <div className="login-page">
      <div className="login-container animate-fade-in">
        <div className="login-card glass-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div className="login-icon" style={{ fontSize: '48px', marginBottom: '20px' }}>🔄</div>
          <h2>Đang xử lý đăng nhập...</h2>
          <p>Vui lòng đợi trong giây lát</p>
          <span className="spinner" style={{ margin: '20px auto', display: 'block' }}></span>
        </div>
      </div>
    </div>
  );
}
