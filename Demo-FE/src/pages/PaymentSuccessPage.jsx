import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import api from '../services/api';
import { FiCheckCircle, FiAlertCircle, FiLoader, FiArrowRight } from 'react-icons/fi';
import backgroundLogin from '../../background/backgroundLogin.webp';
import mascot1 from '../../background/mascot1.png';
import mascot2 from '../../background/mascot2.png';
import './PaymentSuccessPage.css';

const PLAN_DETAILS = {
  starter: {
    name: 'Premium Starter',
    benefits: ['15 lượt ghép mỗi ngày', 'Phiên học tối đa 60 phút', 'Khung avatar Starter Spark'],
  },
  pro: {
    name: 'Premium Pro',
    benefits: ['Không giới hạn lượt ghép', 'Phiên học tối đa 180 phút', 'Khung avatar Pro Crown'],
  },
  ultimate: {
    name: 'Premium Ultimate',
    benefits: ['Không giới hạn lượt ghép', 'Không giới hạn thời gian học', 'Khung avatar Ultimate Cosmic'],
  },
};

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentDetails, setPaymentDetails] = useState(null);
  
  const orderCode = searchParams.get('orderCode');
  const payosStatus = searchParams.get('status');

  useEffect(() => {
    let cancelled = false;
    if (!orderCode) {
      setVerifying(false);
      setErrorMsg('Thiếu mã đơn hàng giao dịch.');
      return;
    }
    if (payosStatus?.toUpperCase() === 'CANCELLED') {
      setVerifying(false);
      setErrorMsg('Giao dịch đã bị hủy trước khi hoàn tất.');
      return;
    }

    const verifyPayment = async () => {
      try {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const { data } = await api.get(`/premium/verify-order/${orderCode}`);
          if (cancelled) return;

          if (data.success) {
            const meRes = await api.get('/auth/me');
            if (!meRes.data.success || cancelled) return;
            const refreshedUser = meRes.data.user;
            if (data.legacyCompletion && refreshedUser.plan !== 'premium') {
              setErrorMsg('Đơn hàng này đã được xử lý trước đây nhưng hiện không có quyền lợi đang hoạt động. Vui lòng liên hệ hỗ trợ.');
              return;
            }
            setPaymentDetails({
              planId: refreshedUser.premiumTier || data.planId,
              expiresAt: refreshedUser.premiumExpiresAt || data.premiumExpiresAt,
            });
            const token = localStorage.getItem('studyrandom_token_v2') || localStorage.getItem('studyrandom_token');
            login(meRes.data.user, token);
            setSuccess(true);
            return;
          }

          if (!['PROCESSING', 'PENDING'].includes(data.status) || attempt === 19) {
            setErrorMsg(data.message || 'Thanh toán chưa hoàn tất.');
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[PaymentSuccess] Verification error:', err);
          setErrorMsg(err.response?.data?.message || 'Lỗi hệ thống khi xác thực giao dịch.');
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };

    verifyPayment();
    return () => { cancelled = true; };
  }, [orderCode, payosStatus, login]);

  const plan = PLAN_DETAILS[paymentDetails?.planId] || PLAN_DETAILS.starter;
  const expiryLabel = paymentDetails?.expiresAt
    ? new Date(paymentDetails.expiresAt).toLocaleDateString('vi-VN')
    : 'Đang cập nhật';

  return (
    <div className="payment-success-page" style={{ backgroundImage: `url(${backgroundLogin})` }}>
      <img src={mascot1} alt="" aria-hidden="true" className="page-mascot page-mascot-left" />
      <img src={mascot2} alt="" aria-hidden="true" className="page-mascot page-mascot-right" />

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
                Gói {plan.name} đã được kích hoạt cho tài khoản của bạn đến ngày {expiryLabel}.
              </p>

              <div className="order-details-summary">
                <div className="summary-row">
                  <span>Mã giao dịch:</span>
                  <strong>#{orderCode}</strong>
                </div>
                <div className="summary-row">
                  <span>Gói dịch vụ:</span>
                  <strong className="premium-accent">{plan.name}</strong>
                </div>
                <div className="summary-row">
                  <span>Trạng thái:</span>
                  <strong className="paid-badge">Đã Thanh Toán</strong>
                </div>
              </div>

              <div className="perk-highlight-row">
                {plan.benefits.map((benefit) => (
                  <div key={benefit} className="perk-badge">{benefit}</div>
                ))}
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
