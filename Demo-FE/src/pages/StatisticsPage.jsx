import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiClock, FiBookOpen, FiZap, FiAward, FiBook } from 'react-icons/fi';
import api from '../services/api';
import backgroundLogin from '../../background/backgroundLogin.png';
import './StatisticsPage.css';

export default function StatisticsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const subjectNames = {
    math: 'Toán học', nodejs: 'Lập trình NodeJS', english: 'Tiếng Anh',
    python: 'Lập trình Python', react: 'React / Frontend', database: 'Cơ sở dữ liệu',
    algorithm: 'Thuật toán', physics: 'Vật lý', triet: 'Triết học',
    lichsu: 'Lịch sử', diali: 'Địa lí',
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/users/stats');
        if (res.data.success) {
          setStatsData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch user stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatStudyTime = (totalMinutes) => {
    if (!totalMinutes || totalMinutes <= 0) return '0 phút';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
    }
    return `${minutes} phút`;
  };

  // Cấu hình vẽ SVG Bar Chart
  const renderChart = () => {
    if (!statsData || !statsData.dailyStudyChart || statsData.dailyStudyChart.length === 0) return null;

    const data = statsData.dailyStudyChart;
    const maxVal = Math.max(...data.map(d => d.minutes), 0);
    const chartMax = Math.max(60, Math.ceil(maxVal / 10) * 10); // Đặt mức tối thiểu là 60m (1h), tự động scale rộng hơn nếu học nhiều hơn

    // Kích thước SVG
    const svgWidth = 600;
    const svgHeight = 250;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 35;

    const plotWidth = svgWidth - paddingLeft - paddingRight;
    const plotHeight = svgHeight - paddingTop - paddingBottom;

    // Tính mốc tọa độ
    const numBars = data.length;
    const barWidth = 32;
    const spacing = numBars > 1 ? (plotWidth - (barWidth * numBars)) / (numBars - 1) : 0;

    // Mốc lưới Y (3 dòng phụ + 1 dòng trục)
    const yGridTicks = [0, chartMax * 0.25, chartMax * 0.5, chartMax * 0.75, chartMax];

    const getX = (index) => paddingLeft + index * (barWidth + spacing);
    const getY = (value) => svgHeight - paddingBottom - (value / chartMax) * plotHeight;

    const handleMouseMove = (e, date, minutes) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
      setHoveredBar({ date, minutes });
    };

    return (
      <div ref={containerRef} className="chart-wrapper">
        {hoveredBar && (
          <div 
            className="chart-tooltip"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y}px` 
            }}
          >
            {hoveredBar.date}: {hoveredBar.minutes} phút học
          </div>
        )}
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="chart-svg">
          {/* Lưới ngang (Y Grid Lines) */}
          {yGridTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i}>
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={svgWidth - paddingRight} 
                  y2={y} 
                  className="chart-grid-line" 
                />
                <text 
                  x={paddingLeft - 10} 
                  y={y + 4} 
                  textAnchor="end" 
                  className="chart-axis-label"
                >
                  {Math.round(tick)}m
                </text>
              </g>
            );
          })}

          {/* Vẽ các cột dữ liệu */}
          {data.map((item, index) => {
            const x = getX(index);
            const valueY = getY(item.minutes);
            const zeroY = getY(0);
            const barHeight = Math.max(zeroY - valueY, 3); // Cao tối thiểu 3px để dễ chỉ chuột

            return (
              <g key={index}>
                {/* Cột chính */}
                <rect
                  x={x}
                  y={valueY}
                  width={barWidth}
                  height={barHeight}
                  rx={6}
                  ry={6}
                  fill="url(#barGradient)"
                  className="chart-bar-rect"
                  onMouseMove={(e) => handleMouseMove(e, item.date, item.minutes)}
                  onMouseLeave={() => setHoveredBar(null)}
                />
                {/* Nhãn ngày (X Axis Labels) */}
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - 12}
                  textAnchor="middle"
                  className="chart-axis-label"
                >
                  {item.date}
                </text>
              </g>
            );
          })}

          {/* Gradients */}
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f783ac" />
              <stop offset="100%" stopColor="#da77f2" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="statistics-page" style={{ backgroundImage: `url(${backgroundLogin})`, backgroundSize: 'cover' }}>
        <div className="loading-wrapper">
          <div className="loading-spinner"></div>
          <p>Đang tải dữ liệu thống kê...</p>
        </div>
      </div>
    );
  }

  // Tỷ lệ % đóng góp cho môn học yêu thích
  const totalFavoriteMinutes = statsData?.favoriteSubjects?.reduce((sum, item) => sum + item.minutes, 0) || 1;

  // Cấu hình huy hiệu
  const badgeDetails = [
    {
      id: 'FIRST_STEP',
      name: 'Khởi Đầu',
      icon: '🌱',
      description: 'Hoàn thành buổi học đầu tiên của bạn tại StudyRandom.',
      condition: 'Học tối thiểu 1 phút.'
    },
    {
      id: 'DEDICATED',
      name: 'Chăm Chỉ',
      icon: '⚡',
      description: 'Tổng thời gian học tập tích lũy đạt mốc 10 giờ.',
      condition: 'Học trên 600 phút.'
    },
    {
      id: 'WEEK_STREAK',
      name: 'Bền Bỉ',
      icon: '🔥',
      description: 'Duy trì chuỗi tự học liên tiếp trong 7 ngày.',
      condition: 'Streak >= 7 ngày.'
    }
  ];

  return (
    <div 
      className="statistics-page" 
      style={{ 
        backgroundImage: `url(${backgroundLogin})`, 
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed' 
      }}
    >
      <div className="stats-container">
        
        {/* Header */}
        <div className="stats-header">
          <button className="back-btn" onClick={() => navigate('/lobby')} title="Quay lại sảnh chờ">
            <FiArrowLeft />
          </button>
          <div className="stats-header-text">
            <h1>Thống Kê Học Tập</h1>
            <p>Theo dõi tiến trình ôn tập và thành tích học tập cá nhân</p>
          </div>
        </div>

        {/* Overview Grid */}
        <div className="overview-grid">
          
          <div className="stats-card">
            <div className="card-icon-wrapper icon-blue">
              <FiClock />
            </div>
            <div className="card-info">
              <h3>Thời gian học</h3>
              <p className="stats-value">{formatStudyTime(statsData?.totalStudyMinutes)}</p>
            </div>
          </div>

          <div className="stats-card">
            <div className="card-icon-wrapper icon-green">
              <FiBookOpen />
            </div>
            <div className="card-info">
              <h3>Số buổi học</h3>
              <p className="stats-value">{statsData?.totalSessions || 0} buổi</p>
            </div>
          </div>

          <div className="stats-card">
            <div className="card-icon-wrapper icon-orange">
              <FiZap />
            </div>
            <div className="card-info">
              <h3>Chuỗi ngày (Streak)</h3>
              <p className="stats-value">{statsData?.streak || 0} ngày 🔥</p>
            </div>
          </div>

          <div className="stats-card">
            <div className="card-icon-wrapper icon-yellow">
              <FiAward />
            </div>
            <div className="card-info">
              <h3>Điểm uy tín</h3>
              <p className="stats-value">{statsData?.reputation ? statsData.reputation.toFixed(1) : '5.0'} ⭐</p>
            </div>
          </div>

        </div>

        {/* Main Stats Grid */}
        <div className="main-stats-grid">
          
          {/* Biểu đồ tuần */}
          <div className="stats-block">
            <h2><FiClock style={{ color: '#f783ac' }} /> Thời Gian Tự Học Trong 7 Ngày Gần Nhất</h2>
            {statsData?.dailyStudyChart && statsData.dailyStudyChart.some(d => d.minutes > 0) ? (
              renderChart()
            ) : (
              <p className="no-data-msg">Chưa có dữ liệu học tập trong tuần qua. Hãy ghép cặp học ngay nhé!</p>
            )}
          </div>

          {/* Side Panel: Favorite Subjects & Badges */}
          <div className="side-stats-wrapper">
            
            {/* Top môn học */}
            <div className="stats-block">
              <h2><FiBook style={{ color: '#51cf66' }} /> Môn Học Ôn Tập Nhiều Nhất</h2>
              {statsData?.favoriteSubjects && statsData.favoriteSubjects.length > 0 ? (
                <div className="subjects-list">
                  {statsData.favoriteSubjects.map((item, idx) => {
                    const pct = Math.max(5, Math.min(100, Math.round((item.minutes / totalFavoriteMinutes) * 100)));
                    return (
                      <div className="subject-stat-item" key={item.subject}>
                        <div className="subject-info-row">
                          <span className="subject-name">{subjectNames[item.subject] || item.subject}</span>
                          <span className="subject-time">{formatStudyTime(item.minutes)}</span>
                        </div>
                        <div className="subject-progress-bg">
                          <div 
                            className={`subject-progress-fill fill-${(idx % 5) + 1}`} 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="no-data-msg">Chưa có môn học học tập. Hãy tham gia sảnh chờ ghép đôi học tập!</p>
              )}
            </div>

            {/* Danh sách huy hiệu */}
            <div className="stats-block">
              <h2><FiAward style={{ color: '#fcc419' }} /> Huy Hiệu Đạt Được ({statsData?.badges?.length || 0}/3)</h2>
              <div className="badges-grid">
                {badgeDetails.map(badge => {
                  const isEarned = statsData?.badges?.includes(badge.id);
                  return (
                    <div 
                      key={badge.id} 
                      className={`badge-item ${isEarned ? 'active' : 'locked'}`}
                    >
                      <div className="badge-circle">
                        {badge.icon}
                      </div>
                      <span className="badge-name">{badge.name}</span>
                      
                      {/* Tooltip hiển thị khi hover */}
                      <div className="badge-desc-tooltip">
                        <strong style={{ display: 'block', marginBottom: '4px', color: isEarned ? '#ffd43b' : '#ced4da' }}>
                          {badge.name}
                        </strong>
                        <p style={{ margin: '0 0 6px 0', opacity: 0.85 }}>{badge.description}</p>
                        <span style={{ fontSize: '10px', color: '#74c0fc', display: 'block' }}>
                          {isEarned ? '🎉 Đã đạt được' : `🔒 ${badge.condition}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
