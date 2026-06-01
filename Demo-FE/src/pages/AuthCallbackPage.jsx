import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './LoginPage.css';

export default function AuthCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const processedRef = useRef(false);

  useEffect(() => {
    // Ngăn chặn xử lý 2 lần do React 18 StrictMode
    if (processedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      navigate('/login?error=google_auth_failed', { replace: true });
      return;
    }

    processedRef.current = true;

    // Tiến hành đăng nhập luồng không đồng bộ: lấy thông tin user hoàn chỉnh từ MongoDB
    const handleLoginFlow = async () => {
      try {
        console.log('[AuthCallback] Received token length:', token.length);
        console.log('[AuthCallback] Token prefix:', token.substring(0, 30));

        // Lưu token tạm thời để api interceptor tự động đính kèm vào header
        localStorage.setItem('studyrandom_token_v2', token);

        // Fetch thông tin profile tươi mới từ database với header được truyền tường minh
        const res = await api.get('/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (res.data && res.data.success) {
          const fullUser = res.data.user;
          console.log('[AuthCallback] Sync user profile SUCCESS:', fullUser.displayName);
          
          // Đăng nhập thành công với đầy đủ profile
          login(fullUser, token);
          navigate('/lobby', { replace: true });
        } else {
          throw new Error('Không thể tải profile của user');
        }
      } catch (err) {
        console.error('[AuthCallback] Lỗi đồng bộ profile:', err);
        if (err.response) {
          console.error('[AuthCallback] Server response error status:', err.response.status);
          console.error('[AuthCallback] Server response error data:', JSON.stringify(err.response.data));
        }
        localStorage.removeItem('studyrandom_token_v2');
        navigate('/login?error=google_auth_failed&reason=profile_error', { replace: true });
      }
    };

    handleLoginFlow();
  }, [login, navigate]);

  return (
    <div className="login-page">
      <div className="login-container animate-fade-in">
        <div className="login-card glass-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div className="login-icon" style={{ fontSize: '48px', marginBottom: '20px' }}>🔄</div>
          <h2>Đang xử lý đăng nhập...</h2>
          <p>Vui lòng lấy thông tin tài khoản Google của bạn</p>
          <span className="spinner" style={{ margin: '20px auto', display: 'block' }}></span>
        </div>
      </div>
    </div>
  );
}
