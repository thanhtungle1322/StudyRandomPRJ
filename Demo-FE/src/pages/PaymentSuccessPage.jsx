import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FiCheckCircle, FiAlertCircle, FiLoader, FiArrowRight } from 'react-icons/fi';
import backgroundLogin from '../../background/backgroundLogin.png';
import mascot1 from '../../background/mascot1.png';
import mascot2 from '../../background/mascot2.png';
import './PaymentSuccessPage.css';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const orderCode = searchParams.get('orderCode');
  const payosStatus = searchParams.get('status');

  useEffect(() => {
    if (!orderCode) {
      setVerifying(false);
      setErrorMsg('Thiếu mã đơn hàng giao dịch.');
      return;
    }

    const verifyPayment = async () => {
      try {
        console.log('[PaymentSuccess] Verifying order code:', orderCode);
        const { data } = await api.get(`/premium/verify-order/${orderCode}`);
        
        if (data.success) {
          setSuccess(true);
          // Refetch user/me to get the latest plan and badges
          const meRes = await api.get('/auth/me');
          if (meRes.data.success) {
            const token = localStorage.getItem('studyrandom_token_v2');
            login(meRes.data.user, token);
          }
        } else {
          setErrorMsg(data.message || 'Thanh toán chưa hoàn tất.');
        }
      } catch (err) {
        console.error('[PaymentSuccess] Verification error:', err);
        setErrorMsg(err.response?.data?.message || 'Lỗi hệ thống khi xác thực giao dịch.');
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [orderCode, login]);

  return (
    <div className="payment-success-page" style={{ backgroundImage: `url(${backgroundLogin})` }}>
      <img src={mascot1} alt="mascot-left" className="lobby-mascot-fixed lobby-mascot-left" />
      <img src={mascot2} alt="mascot-right" className="lobby-mascot-fixed lobby-mascot-right" />

      <div className="container payment-success-container">
        <div className="glass-card success-card animate-fade-in">
          {verifying ? (
            <div className="verification-loading">
              <FiLoader className="verify-spinner" />
              <h2>Đang xác thực giao dịch...</h2>
              <p>Hệ thống đang kiểm tra trạng thái thanh toán từ PayOS, vui lòng giữ nguyên màn hình.</p>
            </div>
          ) : success ? (
            <div className="verification-success">
              <div className="success-badge-wrapper">
                <FiCheckCircle className="success-icon" />
                <div className="success-ripple"></div>
              </div>
              <h1 className="success-title">Nâng Cấp Thành Công! 🎉</h1>
              <p className="success-subtitle">
                Chào mừng bạn đến với gói **Premium** của StudyRandom. Tài khoản của bạn đã được mở khóa toàn bộ giới hạn trọn đời.
              </p>

              <div className="order-details-summary">
                <div className="summary-row">
                  <span>Mã giao dịch:</span>
                  <strong>#{orderCode}</strong>
                </div>
                <div className="summary-row">
                  <span>Gói dịch vụ:</span>
                  <strong className="premium-accent">PREMIUM LIFETIME</strong>
                </div>
                <div className="summary-row">
                  <span>Trạng thái:</span>
                  <strong className="paid-badge">Đã Thanh Toán</strong>
                </div>
              </div>

              <div className="perk-highlight-row">
                <div className="perk-badge">✨ Vô hạn ghép bạn</div>
                <div className="perk-badge">⏳ Không giới hạn giờ học</div>
                <div className="perk-badge">👑 Khung avatar độc quyền</div>
              </div>

              <button className="success-action-btn" onClick={() => navigate('/lobby')}>
                Vào Sảnh chờ Ngay <FiArrowRight />
              </button>
            </div>
          ) : (
            <div className="verification-failure">
              <FiAlertCircle className="error-icon" />
              <h1 className="error-title">Giao Dịch Thất Bại</h1>
              <p className="error-subtitle">{errorMsg || 'Thanh toán bị hủy bỏ hoặc có lỗi xảy ra.'}</p>
              
              <div className="failure-actions">
                <button className="failure-btn retry" onClick={() => navigate('/pricing')}>
                  Thử lại thanh toán
                </button>
                <button className="failure-btn back-lobby" onClick={() => navigate('/lobby')}>
                  Quay lại Sảnh chờ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
