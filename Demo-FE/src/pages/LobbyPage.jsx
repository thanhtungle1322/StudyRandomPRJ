import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { connectSocket, getSocket } from '../services/socket';
import api from '../services/api';
import { FiSearch, FiBook, FiCrosshair, FiEdit3, FiUsers, FiAlertOctagon, FiX, FiZap, FiDatabase, FiGlobe, FiCpu, FiStar } from 'react-icons/fi';
import { FaCalculator, FaNodeJs, FaReact, FaPython } from 'react-icons/fa';
import backgroundLogin from '../../background/backgroundLogin.png';
import mascot1 from '../../background/mascot1.png';
import mascot2 from '../../background/mascot2.png';
import mascot3 from '../../background/mascot3.png';
import './LobbyPage.css';

// Màu pastel cho từng card môn học (giống Figma)
const subjectColors = {
  math:      { bg: '#ffd6e0', icon: '#e64980' },
  nodejs:    { bg: '#d3f9d8', icon: '#2f9e44' },
  english:   { bg: '#e3fafc', icon: '#1098ad' },
  python:    { bg: '#fff3bf', icon: '#e67700' },
  react:     { bg: '#d0ebff', icon: '#1971c2' },
  database:  { bg: '#f3d9fa', icon: '#9c36b5' },
  algorithm: { bg: '#fff3bf', icon: '#e67700' },
  physics:   { bg: '#d3f9d8', icon: '#2f9e44' },
  triet:     { bg: '#e3fafc', icon: '#1098ad' },
  lichsu:    { bg: '#ffd6e0', icon: '#e64980' },
  diali:     { bg: '#d3f9d8', icon: '#2f9e44' },
};

const subjectIcons = {
  math:      <FaCalculator />,
  nodejs:    <FaNodeJs />,
  english:   <FiGlobe />,
  python:    <FaPython />,
  react:     <FaReact />,
  database:  <FiDatabase />,
  algorithm: <FiCpu />,
  physics:   <FiZap />,
  triet:     <FiBook />,
  lichsu:    <FiBook />,
  diali:     <FiGlobe />,
};

export default function LobbyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [queueStats, setQueueStats] = useState({});

  // ---- Premium state ----
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [refundNotification, setRefundNotification] = useState(null);

  // Fetch premium status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data } = await api.get('/premium/status');
        if (data.success) setPremiumStatus(data);
      } catch (_) {}
    };
    fetchStatus();
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data } = await api.get('/subjects');
        if (data.success) setSubjects(data.subjects);
      } catch (err) {
        setSubjects([
          { id: 'math',      name: 'Toán học' },
          { id: 'triet',     name: 'Triết học' },
          { id: 'english',   name: 'Tiếng Anh' },
          { id: 'lichsu',    name: 'Lịch sử' },
          { id: 'diali',     name: 'Địa lí' },
          { id: 'database',  name: 'Cơ sở dữ liệu' },
          { id: 'algorithm', name: 'Thuật toán' },
          { id: 'physics',   name: 'Vật lý' },
        ]);
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    socket.on('matched', (data) => {
      setSearching(false); setSearchTime(0);
      navigate(`/room/${data.roomId}`, {
        state: { partner: data.partner, subject: data.subject, sessionTimeLimit: data.sessionTimeLimit }
      });
    });
    socket.on('waiting', (data) => { if (data.queueStats) setQueueStats(data.queueStats); });
    socket.on('queue_left', () => { setSearching(false); setSearchTime(0); });
    socket.on('queue_stats', (stats) => setQueueStats(stats));

    // Handle match limit reached
    socket.on('match_limit_reached', () => {
      setSearching(false);
      setSearchTime(0);
      setLimitReached(true);
    });

    // Handle match refunded event
    socket.on('match_refunded', (data) => {
      setRefundNotification(data.message);
      // Auto-hide after 8 seconds
      setTimeout(() => setRefundNotification(null), 8000);

      // Dynamically update premiumStatus limits in the state
      setPremiumStatus(prev => {
        if (!prev || prev.isPremium) return prev;
        return {
          ...prev,
          limits: {
            ...prev.limits,
            dailyMatchesUsed: data.dailyMatchCount,
            dailyMatchesRemaining: data.remaining,
          }
        };
      });
    });

    const interval = setInterval(() => socket.emit('get_queue_stats'), 5000);
    return () => {
      clearInterval(interval);
      socket.off('matched'); socket.off('waiting'); socket.off('queue_left');
      socket.off('queue_stats'); socket.off('match_limit_reached');
      socket.off('match_refunded');
    };
  }, [navigate]);

  useEffect(() => {
    let timer;
    if (searching) timer = setInterval(() => setSearchTime((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [searching]);

  const handleSearch = useCallback(() => {
    if (!selectedSubject) return;
    setLimitReached(false);
    const socket = getSocket();
    if (!socket.connected) connectSocket();
    setSearching(true); setSearchTime(0);
    socket.emit('join_queue', { subjectId: selectedSubject });
  }, [selectedSubject]);

  const handleCancelSearch = useCallback(() => {
    getSocket().emit('leave_queue');
    setSearching(false); setSearchTime(0);
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const isPremium = premiumStatus?.isPremium;
  const remaining = premiumStatus?.limits?.dailyMatchesRemaining;

  return (
    <div className="lobby-page" style={{ backgroundImage: `url(${backgroundLogin})` }}>

      {/* Refund Notification Toast */}
      {refundNotification && (
        <div className="lobby-refund-toast animate-fade-in">
          <span className="toast-icon">💸</span>
          <div className="toast-content">
            <h3>Hoàn lượt ghép bạn!</h3>
            <p>{refundNotification}</p>
          </div>
          <button className="toast-close" onClick={() => setRefundNotification(null)}>
            <FiX />
          </button>
        </div>
      )}

      {/* Mascots */}
      <div className="lobby-mascot-fixed lobby-mascot-left">
        <img src={mascot1} alt="Mascot 1" />
      </div>
      <div className="lobby-mascot-fixed lobby-mascot-right">
        <img src={mascot2} alt="Mascot 2" />
      </div>
      <div className="lobby-mascot-fixed lobby-mascot-center-right">
        <img src={mascot3} alt="Mascot 3" />
      </div>

      <div className="container lobby-container">

        {/* Header */}
        <div className="lobby-header animate-fade-in">
          <h1>
            Chào, <span className="lobby-name-highlight">{user?.displayName}</span>! 👋
          </h1>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
            <p style={{ margin: 0 }}>Chọn môn học bạn muốn ôn tập và tìm bạn học ngay</p>
            <span className="lobby-reputation-pill" title="Điểm uy tín đánh giá từ bạn học" style={{ background: 'rgba(132, 94, 247, 0.15)', border: '1px solid rgba(132, 94, 247, 0.3)', padding: '4px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: '800', color: '#845ef7', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ⭐ <strong style={{ color: '#f59f00' }}>{user?.reputation !== undefined ? Number(user.reputation).toFixed(1) : '5.0'}</strong> / 5.0 ({user?.ratingCount || 0} đánh giá)
            </span>
          </div>
        </div>

        {/* Premium Status Banner */}
        {premiumStatus && !isPremium && (
          <div className="lobby-quota-banner animate-fade-in">
            <div className="quota-info">
              <span className="quota-label">Lượt tìm bạn hôm nay:</span>
              <span className={`quota-count ${remaining === 0 ? 'depleted' : ''}`}>
                {remaining ?? '...'} / {premiumStatus.limits?.dailyMatches}
              </span>
            </div>
            <Link to="/pricing" className="quota-upgrade-btn">
              <FiStar /> Nâng cấp Premium
            </Link>
          </div>
        )}

        {isPremium && (
          <div className="lobby-premium-badge animate-fade-in">
            👑 <span>Premium</span> — Không giới hạn lượt tìm & thời gian phiên
          </div>
        )}

        {/* Limit Reached Modal */}
        {limitReached && (
          <div className="search-overlay animate-fade-in">
            <div className="search-modal limit-modal">
              <div className="limit-icon">🔒</div>
              <h2>Hết lượt tìm bạn học!</h2>
              <p className="limit-desc">
                Bạn đã sử dụng hết <strong>{premiumStatus?.limits?.dailyMatches || 3} lượt</strong> miễn phí hôm nay.
              </p>
              <p className="limit-hint">Nâng cấp Premium — mua 1 lần dùng vĩnh viễn!</p>
              <div className="limit-actions">
                <Link to="/pricing" className="btn-find-partner" style={{ textDecoration: 'none' }}>
                  <FiStar /> Xem gói Premium
                </Link>
                <button onClick={() => setLimitReached(false)} className="btn-cancel-search" style={{ marginTop: 8 }}>
                  <FiX /> Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Searching Overlay */}
        {searching && (
          <div className="search-overlay animate-fade-in">
            <div className="search-modal">
              <div className="search-animation">
                <div className="search-ripple">
                  <div className="ripple-ring ripple-ring-1"></div>
                  <div className="ripple-ring ripple-ring-2"></div>
                  <div className="ripple-ring ripple-ring-3"></div>
                  <div className="search-icon-center"><FiSearch /></div>
                </div>
              </div>
              <h2>Đang tìm bạn học...</h2>
              <p className="search-subject">Môn: <strong>{subjects.find(s => s.id === selectedSubject)?.name}</strong></p>
              <p className="search-time">{formatTime(searchTime)}</p>
              <p className="search-hint">Hệ thống đang tìm người cùng môn học với bạn</p>
              <button onClick={handleCancelSearch} className="btn-cancel-search">
                <FiX /> Hủy tìm kiếm
              </button>
            </div>
          </div>
        )}

        {/* Subjects Grid */}
        <div className="subjects-section">
          <h2 className="subjects-title">
            <span className="subjects-title-icon">🎓</span> Chọn Môn Học
          </h2>
          <div className="subjects-grid stagger-children">
            {subjects.map((subject) => {
              const color = subjectColors[subject.id] || { bg: '#e7f5ff', icon: '#339af0' };
              const icon  = subjectIcons[subject.id]  || <FiBook />;
              const isSelected = selectedSubject === subject.id;
              return (
                <button
                  key={subject.id}
                  className={`subject-card ${isSelected ? 'selected' : ''}`}
                  style={{ '--card-bg': color.bg, '--card-icon': color.icon }}
                  onClick={() => setSelectedSubject(subject.id)}
                  disabled={searching}
                >
                  <span className="subject-icon">{icon}</span>
                  <span className="subject-name">{subject.name}</span>
                  {(queueStats[subject.id] || subject.queueCount || 0) > 0 && (
                    <span className="queue-badge">
                      {queueStats[subject.id] || subject.queueCount} đang chờ
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Button */}
        <div className="search-action animate-fade-in">
          <button
            onClick={handleSearch}
            className="btn-find-partner"
            disabled={!selectedSubject || searching}
          >
            <FiCrosshair /> Tìm Bạn Học
          </button>
          {selectedSubject && (
            <p className="search-info">
              Bạn đã chọn: <strong>{subjects.find(s => s.id === selectedSubject)?.name}</strong>
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <div className="quick-card" onClick={() => navigate('/whiteboard')}>
            <span className="quick-icon quick-icon-purple">
              <FiEdit3 />
            </span>
            <div>
              <h3>Bảng Trắng</h3>
              <p>Giải bài tập cùng nhau</p>
            </div>
          </div>
          <div className="quick-card" onClick={() => navigate('/friends')}>
            <span className="quick-icon quick-icon-teal">
              <FiUsers />
            </span>
            <div>
              <h3>Bạn Bè</h3>
              <p>Xem danh sách bạn bè</p>
            </div>
          </div>
          <div className="quick-card" onClick={() => navigate('/report')}>
            <span className="quick-icon quick-icon-yellow">
              <FiAlertOctagon />
            </span>
            <div>
              <h3>Báo Cáo</h3>
              <p>Report hành vi xấu</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
