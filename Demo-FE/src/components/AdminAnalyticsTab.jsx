import { useState, useEffect } from 'react';
import api from '../services/api';
import { initGA } from '../services/analytics';
import { 
  FiSave, 
  FiInfo, 
  FiActivity, 
  FiTrendingUp, 
  FiClock, 
  FiSettings, 
  FiArrowUpRight,
  FiTarget
} from 'react-icons/fi';

export default function AdminAnalyticsTab() {
  const [gaId, setGaId] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  
  // Real Database Statistics
  const [realStats, setRealStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    premiumUsers: 0,
    totalSessions: 0,
    activeSessions: 0,
    totalFeedbacks: 0,
    totalGiftcodes: 0,
    premiumTiers: {
      starter: 0,
      pro: 0,
      ultimate: 0,
      free: 0,
    }
  });
  const [loadingRealStats, setLoadingRealStats] = useState(false);

  // Fetch GA ID from settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/admin/settings');
        if (data.success && data.settings?.gaMeasurementId) {
          setGaId(data.settings.gaMeasurementId);
        }
      } catch (err) {
        console.error('[GA Config] Error fetching settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // Fetch Real Stats from backend
  const fetchRealStats = async () => {
    setLoadingRealStats(true);
    try {
      const { data } = await api.get('/admin/stats');
      if (data.success) {
        setRealStats(data.stats);
      }
    } catch (err) {
      console.error('[Stats] Error fetching real stats:', err);
    } finally {
      setLoadingRealStats(false);
    }
  };

  useEffect(() => {
    fetchRealStats();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg({ type: '', text: '' });

    try {
      const { data } = await api.put('/admin/settings', { gaMeasurementId: gaId.trim() });
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Đã lưu và kích hoạt Google Analytics thành công!' });
        initGA(gaId.trim());
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Có lỗi xảy ra khi lưu cấu hình.' });
    } finally {
      setSaving(false);
    }
  };

  // Premium Tier percentages helper
  const totalTiers = ((realStats.premiumTiers?.free || 0) + (realStats.premiumTiers?.starter || 0) + (realStats.premiumTiers?.pro || 0) + (realStats.premiumTiers?.ultimate || 0)) || 1;
  const pctFree = Math.round(((realStats.premiumTiers?.free || 0) / totalTiers) * 100);
  const pctStarter = Math.round(((realStats.premiumTiers?.starter || 0) / totalTiers) * 100);
  const pctPro = Math.round(((realStats.premiumTiers?.pro || 0) / totalTiers) * 100);
  const pctUltimate = Math.round(((realStats.premiumTiers?.ultimate || 0) / totalTiers) * 100);

  return (
    <div className="analytics-tab-wrapper">
      {/* Settings & Config Bar */}
      <div className="analytics-settings-row" style={{ justifyContent: 'flex-end' }}>
        <form onSubmit={handleSaveSettings} className="ga-config-form">
          <div className="ga-input-group">
            <label htmlFor="ga-measurement-id"><FiSettings /> Mã Google Analytics (GA4 ID):</label>
            <input 
              id="ga-measurement-id"
              type="text" 
              placeholder="Ví dụ: G-L2B3D5E7FG"
              value={gaId}
              onChange={(e) => setGaId(e.target.value)}
              className="ga-input"
            />
            <button type="submit" className="btn btn-primary ga-save-btn" disabled={saving}>
              <FiSave /> {saving ? 'Đang lưu...' : 'Lưu & Kích hoạt'}
            </button>
          </div>
        </form>
      </div>

      {statusMsg.text && (
        <div className={`admin-alert ${statusMsg.type}`} style={{ margin: '0 0 20px 0' }}>
          <span className="alert-text">{statusMsg.text}</span>
        </div>
      )}

      {/* Analytics Info InfoBox */}
      <div className="analytics-info-box glass-card">
        <FiInfo className="info-icon" />
        <div className="info-content">
          <h4>{gaId ? `Google Analytics đang kết nối [${gaId}]` : 'Google Analytics chưa được cấu hình'}</h4>
          <p>
            Mã Google Analytics (GA4) sẽ được tự động tích hợp cho toàn bộ người dùng khi truy cập trang web.
            Để xem báo cáo chuyên sâu và hành vi người dùng chi tiết, vui lòng truy cập{' '}
            <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="external-link">
              Google Analytics Console <FiArrowUpRight />
            </a>.
          </p>
        </div>
      </div>

      {/* Grid Cards Stats */}
      <div className="analytics-stats-grid">
        <div className="stat-card-glow realtime">
          <div className="card-header">
            <span>TRỰC TUYẾN THỰC TẾ</span>
            <span className="pulse-dot"></span>
          </div>
          <div className="card-body">
            <h3>{loadingRealStats ? '...' : realStats.onlineUsers}</h3>
            <p className="card-desc">
              <FiActivity /> Người dùng online trên hệ thống
            </p>
          </div>
        </div>

        <div className="stat-card-glow">
          <div className="card-header">
            <span>TỔNG THÀNH VIÊN ĐĂNG KÝ</span>
            <span className="stat-icon">📄</span>
          </div>
          <div className="card-body">
            <h3>{loadingRealStats ? '...' : realStats.totalUsers.toLocaleString()}</h3>
            <p className="card-desc">
              <FiTrendingUp /> Tài khoản đã tạo trong DB
            </p>
          </div>
        </div>

        <div className="stat-card-glow">
          <div className="card-header">
            <span>NGƯỜI DÙNG PREMIUM (VIP)</span>
            <span className="stat-icon">👑</span>
          </div>
          <div className="card-body">
            <h3>{loadingRealStats ? '...' : realStats.premiumUsers}</h3>
            <p className="card-desc">
              <FiClock /> Thành viên đã kích hoạt VIP
            </p>
          </div>
        </div>

        <div className="stat-card-glow">
          <div className="card-header">
            <span>ĐÁNH GIÁ & PHẢN HỒI</span>
            <span className="stat-icon">💬</span>
          </div>
          <div className="card-body">
            <h3>{loadingRealStats ? '...' : realStats.totalFeedbacks}</h3>
            <p className="card-desc">
              Tổng số phản hồi nhận được
            </p>
          </div>
        </div>

        <div className="stat-card-glow premium-stat">
          <div className="card-header">
            <span>TỔNG PHÒNG HỌC ĐÃ TẠO</span>
            <span className="stat-icon">🤝</span>
          </div>
          <div className="card-body">
            <h3>{loadingRealStats ? '...' : realStats.totalSessions}</h3>
            <p className="card-desc">
              <FiTarget /> Có {realStats.activeSessions} phòng đang hoạt động
            </p>
          </div>
        </div>
      </div>

      {/* Charts & Graphs Row */}
      <div className="analytics-charts-row">
        {/* Left: Line Chart (Hourly Traffic Placeholder) */}
        <div className="chart-wrapper-card glass-card">
          <div className="chart-header">
            <h4>Biểu đồ lưu lượng truy cập theo giờ</h4>
          </div>
          
          <div className="svg-chart-container">
            <div className="no-real-data">
              <p>Kết nối và truy cập console của Google Analytics để xem trực tiếp biểu đồ thời gian thực.</p>
            </div>
          </div>
        </div>

        {/* Right: Bar Chart (Top Pages Placeholder) */}
        <div className="chart-wrapper-card glass-card">
          <div className="chart-header">
            <h4>Đường dẫn trang truy cập phổ biến</h4>
            <span>Số lượt xem</span>
          </div>

          <div className="top-pages-list">
            <div className="no-real-data">
              <p>Vui lòng kết nối Google Analytics để xem báo cáo đường dẫn.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-bottom-row" style={{ gridTemplateColumns: '1fr' }}>
        {/* Left: Traffic Channels (Nguồn truy cập) / Premium Tiers distribution */}
        <div className="bottom-card glass-card">
          <div className="card-title-row">
            <h4>Phân bổ gói tài khoản (Premium Tiers)</h4>
            <span>Tỷ lệ %</span>
          </div>
          <div className="channel-distribution">
            <div className="distribution-bar">
              <div 
                className="segment purple" 
                style={{ width: `${pctFree}%` }} 
                title={`Free: ${pctFree}%`}
              ></div>
              <div 
                className="segment blue" 
                style={{ width: `${pctStarter}%` }} 
                title={`Starter: ${pctStarter}%`}
              ></div>
              <div 
                className="segment green" 
                style={{ width: `${pctPro}%` }} 
                title={`Pro: ${pctPro}%`}
              ></div>
              <div 
                className="segment orange" 
                style={{ width: `${pctUltimate}%` }} 
                title={`Ultimate: ${pctUltimate}%`}
              ></div>
            </div>
            <div className="channel-legend">
              <div className="legend-item"><span className="dot purple"></span> Free (Miễn phí): {pctFree}% ({realStats.premiumTiers?.free} người)</div>
              <div className="legend-item"><span className="dot blue"></span> Starter (Tháng): {pctStarter}% ({realStats.premiumTiers?.starter} người)</div>
              <div className="legend-item"><span className="dot green"></span> Pro (Gói Pro): {pctPro}% ({realStats.premiumTiers?.pro} người)</div>
              <div className="legend-item"><span className="dot orange"></span> Ultimate (Tối đa): {pctUltimate}% ({realStats.premiumTiers?.ultimate} người)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
