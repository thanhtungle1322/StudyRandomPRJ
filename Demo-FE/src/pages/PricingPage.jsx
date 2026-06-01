import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FiCheck, FiStar, FiZap, FiShield, FiArrowLeft } from 'react-icons/fi';
import backgroundLogin from '../../background/backgroundLogin.png';
import mascot1 from '../../background/mascot1.png';
import mascot2 from '../../background/mascot2.png';
import mascot3 from '../../background/mascot3.png';
import './PricingPage.css';

export default function PricingPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [freeLimits, setFreeLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [giftcode, setGiftcode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  
  const [message, setMessage] = useState('');
  
  // Live Avatar Preview State (Discord style)
  const [selectedPreviewPlan, setSelectedPreviewPlan] = useState('starter');

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data } = await api.get('/premium/plans');
        if (data.success) {
          setPlans(data.plans);
          setFreeLimits(data.freeLimits);
        }
      } catch {
        setPlans([
          { id: 'starter', name: 'Starter', price: 5000, durationDays: 30, description: 'Mở rộng giới hạn cơ bản cho việc ôn tập', features: ['15 lượt tìm bạn học / ngày (thay vì 3)', 'Phiên học tối đa 60 phút (thay vì 30)', 'Thời hạn sử dụng: 30 ngày', 'Khung avatar "Starter Spark" hồng lấp lánh', 'Danh hiệu PREMIUM STARTER trong hồ sơ'] },
          { id: 'pro', name: 'Pro', price: 10000, durationDays: 90, popular: true, description: 'Không giới hạn lượt tìm, phiên học 3 tiếng', features: ['Không giới hạn lượt tìm bạn học / ngày', 'Phiên học tối đa 180 phút (3 tiếng)', 'Thời hạn sử dụng: 90 ngày', 'Khung avatar "Pro Crown" vương miện vàng', 'Danh hiệu PREMIUM PRO trong hồ sơ', 'Ưu tiên ghép đôi nhanh hơn'] },
          { id: 'ultimate', name: 'Ultimate', price: 15000, durationDays: 365, description: 'Trải nghiệm tối thượng, không giới hạn bất kỳ điều gì', features: ['Không giới hạn lượt tìm bạn học / ngày', 'Không giới hạn thời gian phiên học', 'Thời hạn sử dụng: 365 ngày (1 năm)', 'Khung avatar "Ultimate Cosmic" vũ trụ huyền ảo', 'Danh hiệu PREMIUM ULTIMATE trong hồ sơ', 'Truy cập tính năng beta sớm', 'Hỗ trợ VIP 24/7'] },
        ]);
        setFreeLimits({ dailyMatches: 3, sessionMinutes: 30 });
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handlePurchase = async (planId) => {
    if (!user) { navigate('/login'); return; }
    setPurchasing(planId);
    setMessage('');
    try {
      const { data } = await api.post('/premium/purchase', { planId });
      if (data.success) {
        if (data.usePayOS && data.checkoutUrl) {
          setMessage('Đang chuyển hướng tới cổng thanh toán PayOS... 💳');
          setTimeout(() => {
            window.location.href = data.checkoutUrl;
          }, 1200);
        } else {
          setMessage(data.message);
          const token = localStorage.getItem('studyrandom_token_v2');
          login({ ...user, plan: 'premium', premiumTier: planId, premiumPurchasedAt: data.premiumPurchasedAt, premiumExpiresAt: data.premiumExpiresAt, badges: data.badges }, token);
          setTimeout(() => navigate('/lobby'), 2000);
        }
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setPurchasing(null);
    }
  };

  const handleRedeemGiftcode = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!giftcode.trim()) {
      setMessage('Vui lòng nhập mã Giftcode');
      return;
    }
    
    setRedeeming(true);
    setMessage('');
    
    try {
      const { data } = await api.post('/premium/redeem-giftcode', { code: giftcode });
      if (data.success) {
        setMessage(data.message);
        setGiftcode('');
        
        // Find which plan was redeemed from data
        const token = localStorage.getItem('studyrandom_token_v2');
        
        // Let's decode or get updated user info from response
        login({ 
          ...user, 
          plan: 'premium', 
          premiumTier: data.planTier || data.premiumTier || 'starter',
          premiumPurchasedAt: data.premiumPurchasedAt, 
          premiumExpiresAt: data.premiumExpiresAt,
          badges: data.badges 
        }, token);
        
        setTimeout(() => navigate('/lobby'), 2500);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Lỗi khi kích hoạt Giftcode, vui lòng thử lại.');
    } finally {
      setRedeeming(false);
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  
  const TIER_LEVELS = { none: 0, starter: 1, pro: 2, ultimate: 3 };
  const premiumTier = user?.premiumTier || 'none';
  const currentTierLevel = TIER_LEVELS[premiumTier] || 0;
  const isPremium = user?.plan === 'premium';
  
  const planIcons = { starter: <FiZap />, pro: <FiStar />, ultimate: <FiShield /> };

  // Avatar and Display details
  const avatarSrc = user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || 'guest'}`;
  const displayName = user?.displayName || 'Bạn học ngẫu nhiên';

  // Preview Decor Classes Mapping
  const previewDecors = {
    free: { wrapper: '', overlay: '' },
    starter: { wrapper: 'has-decor-starter', overlay: 'decor-starter' },
    pro: { wrapper: 'has-decor-pro', overlay: 'decor-pro' },
    ultimate: { wrapper: 'has-decor-ultimate', overlay: 'decor-ultimate' }
  };

  const currentPreview = previewDecors[selectedPreviewPlan] || previewDecors.starter;

  if (loading) {
    return (
      <div className="pricing-page" style={{ backgroundImage: `url(${backgroundLogin})` }}>
        <div className="pricing-loading"><div className="spinner"></div><p>Đang tải...</p></div>
      </div>
    );
  }

  return (
    <div className="pricing-page" style={{ backgroundImage: `url(${backgroundLogin})` }}>
      {/* Mascot decorations similar to Lobby */}
      <img src={mascot1} alt="mascot-left" className="lobby-mascot-fixed lobby-mascot-left" />
      <img src={mascot2} alt="mascot-right" className="lobby-mascot-fixed lobby-mascot-right" />
      <img src={mascot3} alt="mascot-center" className="lobby-mascot-fixed lobby-mascot-center-right" />

      <div className="container pricing-container">
        <button className="pricing-back-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft /> Quay lại
        </button>

        {/* Header */}
        <div className="pricing-header animate-fade-in">
          <div className="pricing-badge">
            <span className="pricing-badge-dot"></span>
            <span>Gói có thời hạn • Nâng cấp trải nghiệm</span>
          </div>
          <h1 className="pricing-title">
            Nâng cấp <span className="pricing-title-highlight">Premium</span>
          </h1>
          <p className="pricing-subtitle">
            Mở khóa toàn bộ tính năng, tìm bạn học không giới hạn & nhận khung trang trí avatar cực ngầu
          </p>
        </div>

        {/* Interactive Discord-style Avatar Preview Card */}
        <div className="avatar-live-preview-card glass-card animate-fade-in">
          <div className="preview-card-left">
            <div className={`avatar-decor-wrapper ${currentPreview.wrapper}`} style={{ width: '80px', height: '80px' }}>
              <img
                src={avatarSrc}
                alt="Live Preview Avatar"
                className="avatar-decor-img"
                style={{ border: '4px solid #ffffff' }}
              />
              {currentPreview.overlay && <div className={`avatar-decor-overlay ${currentPreview.overlay}`}></div>}
            </div>
            <div className="preview-user-info">
              <h4>{displayName}</h4>
              <span className={`plan-badge-preview ${selectedPreviewPlan}`}>
                Gói: {selectedPreviewPlan === 'free' ? 'Miễn phí' : selectedPreviewPlan.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="preview-card-right">
            <h5>📱 Thử trước khung avatar của bạn:</h5>
            <div className="preview-plan-selector">
              <button 
                className={`preview-select-btn ${selectedPreviewPlan === 'free' ? 'active' : ''}`}
                onClick={() => setSelectedPreviewPlan('free')}
              >
                Trơn (Free)
              </button>
              <button 
                className={`preview-select-btn starter ${selectedPreviewPlan === 'starter' ? 'active' : ''}`}
                onClick={() => setSelectedPreviewPlan('starter')}
              >
                Starter Spark
              </button>
              <button 
                className={`preview-select-btn pro ${selectedPreviewPlan === 'pro' ? 'active' : ''}`}
                onClick={() => setSelectedPreviewPlan('pro')}
              >
                Pro Crown
              </button>
              <button 
                className={`preview-select-btn ultimate ${selectedPreviewPlan === 'ultimate' ? 'active' : ''}`}
                onClick={() => setSelectedPreviewPlan('ultimate')}
              >
                Ultimate Cosmic
              </button>
            </div>
          </div>
        </div>

        {/* Free limits info */}
        {freeLimits && !isPremium && (
          <div className="free-limits-card animate-fade-in">
            <div className="free-limits-icon">🎓</div>
            <div className="free-limits-content">
              <h3>Gói Miễn Phí (hiện tại)</h3>
              <div className="free-limits-list">
                <span className="free-limit-item">
                  <span className="free-limit-num">{freeLimits.dailyMatches}</span> lượt ghép đôi/ngày
                </span>
                <span className="free-limit-divider">•</span>
                <span className="free-limit-item">
                  <span className="free-limit-num">{freeLimits.sessionMinutes}</span> phút/phiên học
                </span>
              </div>
            </div>
          </div>
        )}

        {isPremium && (
          <div className="premium-active-card animate-fade-in">
            <div className="premium-active-icon">👑</div>
            <div>
              <h3>Bạn đang sử dụng gói Premium {premiumTier.toUpperCase()}!</h3>
              <p>
                {user?.premiumExpiresAt 
                  ? `Hết hạn: ${new Date(user.premiumExpiresAt).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}` 
                  : 'Vĩnh viễn (Admin)'}
              </p>
            </div>
          </div>
        )}

        {/* Giftcode redemption section */}
        {currentTierLevel < 3 && (
          <div className="giftcode-redeem-card glass-card animate-fade-in" style={{ marginTop: '24px', marginBottom: '24px' }}>
            <div className="giftcode-content">
              <div className="giftcode-title-wrapper">
                <span className="giftcode-icon">🎁</span>
                <div>
                  <h3>Bạn có mã quà tặng (Giftcode)?</h3>
                  <p>Nhập mã để nâng cấp ngay lên gói Premium cao hơn trọn đời mà không cần thanh toán!</p>
                </div>
              </div>
              <form onSubmit={handleRedeemGiftcode} className="giftcode-form">
                <input
                  type="text"
                  placeholder="Nhập mã Giftcode nâng cấp (Ví dụ: SR-PRO-XXXX)..."
                  className="giftcode-input"
                  value={giftcode}
                  onChange={(e) => setGiftcode(e.target.value)}
                  disabled={redeeming}
                />
                <button 
                  type="submit" 
                  className="giftcode-submit-btn" 
                  disabled={redeeming || !giftcode.trim()}
                >
                  {redeeming ? <span className="spinner"></span> : 'Kích hoạt'}
                </button>
              </form>
            </div>
          </div>
        )}

        {message && (
          <div className={`pricing-message animate-fade-in ${message.includes('thành công') || message.includes('Chúc mừng') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {/* Plans Grid */}
        <div className="pricing-grid stagger-children">
          {plans.map((plan) => (
            <div 
              key={plan.id} 
              className={`pricing-card ${plan.popular ? 'pricing-card-popular' : ''}`}
              onMouseEnter={() => setSelectedPreviewPlan(plan.id)}
            >
              {plan.popular && <div className="pricing-popular-badge">🔥 Phổ biến nhất</div>}

              <div className="pricing-card-header">
                <div className={`pricing-plan-icon ${plan.popular ? 'icon-popular' : ''}`}>
                  {planIcons[plan.id] || <FiStar />}
                </div>
                <h3 className="pricing-plan-name">{plan.name}</h3>
                <p className="pricing-plan-desc">{plan.description}</p>
              </div>

              <div className="pricing-price">
                <span className="pricing-price-amount">{formatPrice(plan.price)}</span>
                <span className="pricing-price-label">{plan.durationDays || 30} ngày</span>
              </div>

              <ul className="pricing-features">
                {plan.features.map((feature, i) => (
                  <li key={i}><span className="pricing-check"><FiCheck /></span>{feature}</li>
                ))}
              </ul>

              <button
                className={`pricing-buy-btn ${plan.popular ? 'btn-popular' : ''}`}
                onClick={() => handlePurchase(plan.id)}
                disabled={currentTierLevel >= TIER_LEVELS[plan.id] || purchasing === plan.id}
              >
                {purchasing === plan.id ? (
                  <><span className="spinner"></span> Đang xử lý...</>
                ) : currentTierLevel >= TIER_LEVELS[plan.id] ? 'Đã sở hữu ✓' : `Mua ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="pricing-faq animate-fade-in">
          <h2>Câu hỏi thường gặp</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>💡 Premium có hết hạn không?</h4>
              <p>Có! Mỗi gói có thời hạn riêng: Starter 30 ngày, Pro 90 ngày, Ultimate 365 ngày. Khi hết hạn, khung avatar và danh hiệu premium sẽ bị thu hồi.</p>
            </div>
            <div className="faq-item">
              <h4>🔒 Thanh toán an toàn?</h4>
              <p>Cổng thanh toán bảo mật, thông tin giao dịch an toàn tuyệt đối.</p>
            </div>
            <div className="faq-item">
              <h4>🎓 Free bị giới hạn gì?</h4>
              <p>{freeLimits?.dailyMatches || 3} lượt/ngày và {freeLimits?.sessionMinutes || 30} phút/phiên.</p>
            </div>
            <div className="faq-item">
              <h4>↩️ Khung avatar hiển thị ở đâu?</h4>
              <p>Khung avatar hiển thị tự hào trên thanh Navbar, Sảnh chờ và trong Phòng học gọi video.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
