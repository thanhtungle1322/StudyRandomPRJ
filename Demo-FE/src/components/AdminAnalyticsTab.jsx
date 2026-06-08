import { useState, useEffect } from 'react';
import api from '../services/api';
import { initGA } from '../services/analytics';
import { 
  FiSave, 
  FiInfo, 
  FiActivity, 
  FiTrendingUp, 
  FiClock, 
  FiGrid, 
  FiCornerDownRight, 
  FiSettings, 
  FiCpu, 
  FiToggleLeft, 
  FiToggleRight, 
  FiArrowUpRight,
  FiTarget
} from 'react-icons/fi';

export default function AdminAnalyticsTab() {
  const [gaId, setGaId] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [isDemoMode, setIsDemoMode] = useState(true);
  
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
  
  // Simulated Analytics States (Presentation Mode)
  const [realtimeUsers, setRealtimeUsers] = useState(14);
  const [pageViews, setPageViews] = useState(4829);
  const [avgDuration, setAvgDuration] = useState('12m 45s');
  const [bounceRate, setBounceRate] = useState('24.8%');
  const [matchCount, setMatchCount] = useState(382);
  
  // Real-time scrolling events log
  const [eventLog, setEventLog] = useState([
    { id: 1, time: 'Vừa xong', name: 'matchmaking_success', detail: 'Phòng học Toán #304 - 2 thành viên' },
    { id: 2, time: '1 phút trước', name: 'page_view', detail: 'Đường dẫn: /lobby' },
    { id: 3, time: '2 phút trước', name: 'premium_upgrade', detail: 'Người dùng: tungle132 (Gói PRO)' },
    { id: 4, time: '3 phút trước', name: 'matchmaking_start', detail: 'Môn học: Tiếng Anh - Lớp 12' },
    { id: 5, time: '5 phút trước', name: 'whiteboard_use', detail: 'Người dùng kích hoạt bảng vẽ nhóm' },
  ]);

  // Hourly page views data for Line Chart
  const [hourlyData, setHourlyData] = useState([
    120, 150, 180, 240, 220, 310, 420, 380, 410, 480, 520, 590, 
    550, 490, 450, 480, 520, 610, 720, 680, 640, 510, 320, 210
  ]);

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
    if (!isDemoMode) {
      fetchRealStats();
    }
  }, [isDemoMode]);

  // Fluctuating data logic for presentation mode
  useEffect(() => {
    if (!isDemoMode) return;

    const interval = setInterval(() => {
      // Fluctuate active users
      setRealtimeUsers(prev => {
        const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        const next = prev + change;
        return next < 5 ? 5 : next > 28 ? 28 : next;
      });

      // Increase pageviews & matchmaking count slowly
      setPageViews(prev => prev + Math.floor(Math.random() * 3) + 1);
      setMatchCount(prev => prev + (Math.random() > 0.7 ? 1 : 0));

      // Append new event to log
      const logOptions = [
        { name: 'page_view', detail: 'Đường dẫn: /pricing' },
        { name: 'page_view', detail: 'Đường dẫn: /lobby' },
        { name: 'matchmaking_start', detail: 'Môn học: Vật Lý - Ghép ngẫu nhiên' },
        { name: 'matchmaking_success', detail: 'Ghép cặp thành công môn Hóa học' },
        { name: 'premium_upgrade', detail: 'Nâng cấp Premium STARTER qua MoMo' },
        { name: 'friend_request', detail: 'Gửi yêu cầu kết bạn' },
        { name: 'whiteboard_use', detail: 'Lưu bảng vẽ thành công' },
      ];

      const selected = logOptions[Math.floor(Math.random() * logOptions.length)];
      const now = new Date();
      const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setEventLog(prev => [
        { id: Date.now(), time: timeStr, name: selected.name, detail: selected.detail },
        ...prev.slice(0, 6) // keep top 7 events
      ]);

      // Adjust hourly traffic chart slightly to look alive
      setHourlyData(prev => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        const noise = Math.floor(Math.random() * 21) - 10; // -10 to +10
        next[lastIdx] = Math.max(150, next[lastIdx] + noise);
        return next;
      });

    }, 3500);

    return () => clearInterval(interval);
  }, [isDemoMode]);

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

  // SVG Line Chart Generation helpers
  const svgWidth = 600;
  const svgHeight = 180;
  const paddingX = 40;
  const paddingY = 20;
  
  const maxVal = Math.max(...hourlyData);
  const minVal = Math.min(...hourlyData);
  const range = maxVal - minVal || 1;

  const points = hourlyData.map((val, idx) => {
    const x = paddingX + (idx / (hourlyData.length - 1)) * (svgWidth - paddingX * 2);
    const y = svgHeight - paddingY - ((val - minVal) / range) * (svgHeight - paddingY * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${paddingX},${svgHeight - paddingY} ${points} ${svgWidth - paddingX},${svgHeight - paddingY} Z`;

  // Premium Tier percentages helper
  const totalTiers = ((realStats.premiumTiers?.free || 0) + (realStats.premiumTiers?.starter || 0) + (realStats.premiumTiers?.pro || 0) + (realStats.premiumTiers?.ultimate || 0)) || 1;
  const pctFree = Math.round(((realStats.premiumTiers?.free || 0) / totalTiers) * 100);
  const pctStarter = Math.round(((realStats.premiumTiers?.starter || 0) / totalTiers) * 100);
  const pctPro = Math.round(((realStats.premiumTiers?.pro || 0) / totalTiers) * 100);
  const pctUltimate = Math.round(((realStats.premiumTiers?.ultimate || 0) / totalTiers) * 100);

  return (
    <div className="analytics-tab-wrapper">
      {/* Settings & Config Bar */}
      <div className="analytics-settings-row">
        <div className="analytics-mode-toggle" onClick={() => setIsDemoMode(!isDemoMode)}>
          <span className="toggle-label">Chế độ thuyết trình:</span>
          <button className={`toggle-btn ${isDemoMode ? 'active' : ''}`}>
            {isDemoMode ? <FiToggleRight className="toggle-icon-on" /> : <FiToggleLeft className="toggle-icon-off" />}
            <span className="toggle-text">{isDemoMode ? 'Bật (Dữ liệu mô phỏng)' : 'Tắt (Dữ liệu thật)'}</span>
          </button>
        </div>

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
            <span>{isDemoMode ? 'ĐANG HOẠT ĐỘNG (REAL-TIME)' : 'TRỰC TUYẾN THỰC TẾ'}</span>
            <span className="pulse-dot"></span>
          </div>
          <div className="card-body">
            <h3>{isDemoMode ? realtimeUsers : realStats.onlineUsers}</h3>
            <p className="card-desc">
              <FiActivity /> {isDemoMode ? 'Số người đang trực tuyến trên web' : 'Người dùng online trên hệ thống'}
            </p>
          </div>
        </div>

        <div className="stat-card-glow">
          <div className="card-header">
            <span>{isDemoMode ? 'TỔNG SỐ LƯỢT XEM TRANG' : 'TỔNG THÀNH VIÊN ĐĂNG KÝ'}</span>
            <span className="stat-icon">📄</span>
          </div>
          <div className="card-body">
            <h3>{isDemoMode ? pageViews.toLocaleString() : realStats.totalUsers.toLocaleString()}</h3>
            <p className="card-desc">
              <FiTrendingUp /> {isDemoMode ? 'Tăng 12% so với hôm qua' : 'Tài khoản đã tạo trong DB'}
            </p>
          </div>
        </div>

        <div className="stat-card-glow">
          <div className="card-header">
            <span>{isDemoMode ? 'THỜI GIAN TRUNG BÌNH PHIÊN' : 'NGƯỜI DÙNG PREMIUM (VIP)'}</span>
            <span className="stat-icon">⏱️</span>
          </div>
          <div className="card-body">
            <h3>{isDemoMode ? avgDuration : realStats.premiumUsers}</h3>
            <p className="card-desc">
              <FiClock /> {isDemoMode ? 'Tương tác ghép học cao' : 'Thành viên đã kích hoạt VIP'}
            </p>
          </div>
        </div>

        <div className="stat-card-glow">
          <div className="card-header">
            <span>{isDemoMode ? 'TỶ LỆ THOÁT (BOUNCE RATE)' : 'ĐÁNH GIÁ & PHẢN HỒI'}</span>
            <span className="stat-icon">📉</span>
          </div>
          <div className="card-body">
            <h3>{isDemoMode ? bounceRate : realStats.totalFeedbacks}</h3>
            <p className="card-desc">
              {isDemoMode ? 'Chỉ số chuyển đổi phòng tốt' : 'Tổng số phản hồi nhận được'}
            </p>
          </div>
        </div>

        <div className="stat-card-glow premium-stat">
          <div className="card-header">
            <span>{isDemoMode ? 'TỔNG SỐ LƯỢT GHÉP CẶP' : 'TỔNG PHÒNG HỌC ĐÃ TẠO'}</span>
            <span className="stat-icon">🤝</span>
          </div>
          <div className="card-body">
            <h3>{isDemoMode ? matchCount : realStats.totalSessions}</h3>
            <p className="card-desc">
              <FiTarget /> {isDemoMode ? 'Tỷ lệ ghép thành công 94.2%' : `Có ${realStats.activeSessions} phòng đang hoạt động`}
            </p>
          </div>
        </div>
      </div>

      {/* Charts & Graphs Row */}
      <div className="analytics-charts-row">
        {/* Left: Line Chart (Hourly Traffic) */}
        <div className="chart-wrapper-card glass-card">
          <div className="chart-header">
            <h4>Biểu đồ lưu lượng truy cập theo giờ</h4>
            <span className="badge-live">LIVE</span>
          </div>
          
          <div className="svg-chart-container">
            {isDemoMode ? (
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="svg-chart">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(132, 94, 247, 0.4)" />
                    <stop offset="100%" stopColor="rgba(132, 94, 247, 0.0)" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal Gridlines */}
                <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="rgba(255, 255, 255, 0.07)" strokeDasharray="3,3" />
                <line x1={paddingX} y1={svgHeight / 2} x2={svgWidth - paddingX} y2={svgHeight / 2} stroke="rgba(255, 255, 255, 0.07)" strokeDasharray="3,3" />
                <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke="rgba(255, 255, 255, 0.15)" />

                {/* Fill Area under the line */}
                <polygon points={areaPoints} fill="url(#chartGrad)" />

                {/* Line path */}
                <polyline points={points} fill="none" stroke="#845ef7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Interactive dots for key peaks */}
                {hourlyData.map((val, idx) => {
                  if (idx % 4 === 0 || idx === hourlyData.length - 1) {
                    const x = paddingX + (idx / (hourlyData.length - 1)) * (svgWidth - paddingX * 2);
                    const y = svgHeight - paddingY - ((val - minVal) / range) * (svgHeight - paddingY * 2);
                    return (
                      <g key={idx} className="chart-dot-group">
                        <circle cx={x} cy={y} r="5" fill="#845ef7" />
                        <circle cx={x} cy={y} r="10" fill="none" stroke="#845ef7" strokeWidth="1" className="ping-ring" />
                        <text x={x} y={y - 10} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">{val}</text>
                      </g>
                    );
                  }
                  return null;
                })}

                {/* X-axis labels */}
                <text x={paddingX} y={svgHeight - 4} fill="#868e96" fontSize="9">00:00</text>
                <text x={svgWidth / 2} y={svgHeight - 4} textAnchor="middle" fill="#868e96" fontSize="9">12:00</text>
                <text x={svgWidth - paddingX} y={svgHeight - 4} textAnchor="end" fill="#868e96" fontSize="9">23:00</text>
              </svg>
            ) : (
              <div className="no-real-data">
                <p>Kết nối và truy cập console của Google Analytics để xem trực tiếp biểu đồ thời gian thực.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Bar Chart (Top Pages) */}
        <div className="chart-wrapper-card glass-card">
          <div className="chart-header">
            <h4>Đường dẫn trang truy cập phổ biến</h4>
            <span>Số lượt xem</span>
          </div>

          <div className="top-pages-list">
            {isDemoMode ? (
              <>
                <div className="page-row">
                  <div className="page-info">
                    <span className="page-path">/lobby (Sảnh ghép cặp)</span>
                    <span className="page-count">1,824 views</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill purple" style={{ width: '85%' }}></div>
                  </div>
                </div>

                <div className="page-row">
                  <div className="page-info">
                    <span className="page-path">/room/:roomId (Phòng học nhóm)</span>
                    <span className="page-count">1,215 views</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill blue" style={{ width: '60%' }}></div>
                  </div>
                </div>

                <div className="page-row">
                  <div className="page-info">
                    <span className="page-path">/pricing (Bảng giá Premium)</span>
                    <span className="page-count">948 views</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill pink" style={{ width: '45%' }}></div>
                  </div>
                </div>

                <div className="page-row">
                  <div className="page-info">
                    <span className="page-path">/stats (Báo cáo cá nhân)</span>
                    <span className="page-count">512 views</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill green" style={{ width: '28%' }}></div>
                  </div>
                </div>

                <div className="page-row">
                  <div className="page-info">
                    <span className="page-path">/friends (Bạn bè)</span>
                    <span className="page-count">330 views</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill orange" style={{ width: '18%' }}></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="no-real-data">
                <p>Vui lòng kết nối Google Analytics để xem báo cáo đường dẫn.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="analytics-bottom-row">
        {/* Left: Traffic Channels (Nguồn truy cập) */}
        <div className="bottom-card glass-card">
          <div className="card-title-row">
            <h4>{isDemoMode ? 'Nguồn traffic truy cập (Traffic Acquisition)' : 'Phân bổ gói tài khoản (Premium Tiers)'}</h4>
            <span>Tỷ lệ %</span>
          </div>
          <div className="channel-distribution">
            <div className="distribution-bar">
              <div 
                className="segment purple" 
                style={{ width: `${isDemoMode ? 45 : pctFree}%` }} 
                title={isDemoMode ? 'Direct: 45%' : `Free: ${pctFree}%`}
              ></div>
              <div 
                className="segment blue" 
                style={{ width: `${isDemoMode ? 30 : pctStarter}%` }} 
                title={isDemoMode ? 'Social: 30%' : `Starter: ${pctStarter}%`}
              ></div>
              <div 
                className="segment green" 
                style={{ width: `${isDemoMode ? 15 : pctPro}%` }} 
                title={isDemoMode ? 'Organic Search: 15%' : `Pro: ${pctPro}%`}
              ></div>
              <div 
                className="segment orange" 
                style={{ width: `${isDemoMode ? 10 : pctUltimate}%` }} 
                title={isDemoMode ? 'Referral: 10%' : `Ultimate: ${pctUltimate}%`}
              ></div>
            </div>
            <div className="channel-legend">
              {isDemoMode ? (
                <>
                  <div className="legend-item"><span className="dot purple"></span> Trực tiếp (Direct): 45%</div>
                  <div className="legend-item"><span className="dot blue"></span> Mạng xã hội (Social): 30%</div>
                  <div className="legend-item"><span className="dot green"></span> Tìm kiếm tự nhiên (Organic): 15%</div>
                  <div className="legend-item"><span className="dot orange"></span> Giới thiệu (Referrals): 10%</div>
                </>
              ) : (
                <>
                  <div className="legend-item"><span className="dot purple"></span> Free (Miễn phí): {pctFree}% ({realStats.premiumTiers?.free} người)</div>
                  <div className="legend-item"><span className="dot blue"></span> Starter (Tháng): {pctStarter}% ({realStats.premiumTiers?.starter} người)</div>
                  <div className="legend-item"><span className="dot green"></span> Pro (Gói Pro): {pctPro}% ({realStats.premiumTiers?.pro} người)</div>
                  <div className="legend-item"><span className="dot orange"></span> Ultimate (Tối đa): {pctUltimate}% ({realStats.premiumTiers?.ultimate} người)</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Event Log */}
        <div className="bottom-card glass-card">
          <div className="card-title-row">
            <h4>Nhật ký sự kiện thời gian thực (Real-time Event Tracker)</h4>
            <span className="badge-tracker">LIVE STREAM</span>
          </div>

          <div className="event-stream-container">
            {eventLog.map(evt => (
              <div key={evt.id} className="event-log-item animate-fade-in">
                <span className="event-time">{evt.time}</span>
                <span className={`event-badge ${evt.name}`}>{evt.name}</span>
                <div className="event-detail">
                  <FiCornerDownRight className="detail-arrow" />
                  <span className="detail-text">{evt.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
