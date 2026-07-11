import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import {
  FiClock, FiSearch, FiZap, FiAward, FiUser,
} from 'react-icons/fi';
import { FaTrophy, FaFire, FaMedal, FaStar } from 'react-icons/fa';
import backgroundLogin from '../../background/backgroundLogin.webp';
import api from '../services/api';
import './LeaderboardPage.css';

export default function LeaderboardPage() {
  const { user, refreshUser } = useAuth();

  const [allUsers, setAllUsers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [sortBy, setSortBy]         = useState('totalStudyMinutes');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/users/leaderboard', {
        params: { sortBy: 'totalStudyMinutes', limit: 100 },
      });
      if (!data.success) throw new Error(data.message || 'Không thể tải bảng xếp hạng');
      setAllUsers(data.data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setError('Không thể tải bảng xếp hạng. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Fetch once on mount ---- */
  useEffect(() => {
    fetchLeaderboard();
    if (refreshUser) {
      refreshUser();
    }
  }, [fetchLeaderboard, refreshUser]);

  /* ---- Client-side sort + search ---- */
  const displayUsers = useMemo(() => {
    let result = [...allUsers];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((u) =>
        (u.displayName || u.username || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'totalStudyMinutes') return (b.totalStudyMinutes || 0) - (a.totalStudyMinutes || 0);
      if (sortBy === 'reputation')        return (b.reputation || 0) - (a.reputation || 0);
      return 0;
    });
    return result;
  }, [allUsers, sortBy, searchQuery]);

  /* ---- Helpers ---- */
  const formatTime = (minutes) => {
    if (!minutes) return '0 phút';
    if (minutes < 60) return `${minutes} phút`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Badge: hiển thị nhỏ gọn trong cell
  const getBadgeIcon = (badge) => {
    switch (badge) {
      case 'FIRST_STEP':  return { icon: <FiUser  />, color: '#74c0fc', label: 'Người mới' };
      case 'DEDICATED':   return { icon: <FiZap   />, color: '#ffd43b', label: 'Chăm chỉ' };
      case 'WEEK_STREAK': return { icon: <FaFire  />, color: '#ff6b35', label: '7 ngày liên tiếp' };
      default:            return { icon: <FiAward />, color: '#cc5de8', label: 'Huy hiệu' };
    }
  };

  // Rank: dùng FaMedal cho cả 3 hạng → cùng icon, khác màu
  const getRankDisplay = (index) => {
    if (index === 0) return <FaMedal className="lb-medal lb-medal-gold"   title="Hạng 1" />;
    if (index === 1) return <FaMedal className="lb-medal lb-medal-silver" title="Hạng 2" />;
    if (index === 2) return <FaMedal className="lb-medal lb-medal-bronze" title="Hạng 3" />;
    return <span className="lb-rank-num">#{index + 1}</span>;
  };

  const getRankClass = (index) => {
    if (index === 0) return 'lb-row-gold';
    if (index === 1) return 'lb-row-silver';
    if (index === 2) return 'lb-row-bronze';
    return '';
  };

  const isCurrentUser = (u) =>
    user && (user.id === u._id || user.dbId === u._id || user.id === u.id);

  return (
    <div
      className="leaderboard-page"
      style={{
        backgroundImage:    `url(${backgroundLogin})`,
        backgroundSize:     'cover',
        backgroundPosition: 'center top',
        backgroundRepeat:   'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="leaderboard-container">

        {/* ---- Page Header ---- */}
        <div className="leaderboard-header animate-fade-in">
          <FaTrophy className="leaderboard-header-icon" />
          <h1>Bảng Xếp Hạng</h1>
          <p>Cùng thi đua học tập với cộng đồng StudyRandom</p>
        </div>

        {/* ---- My Stats Card ---- */}
        {user && (
          <div className="lb-my-stats-card animate-fade-in">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`}
              alt="Bạn"
              className="lb-my-avatar"
            />
            <div className="lb-my-info">
              <h3>Thành tích của bạn: <span className="lb-my-name">{user.displayName}</span></h3>
              <div className="lb-my-stats-row">
                <div className="lb-stat-pill">
                  <FiClock className="lb-stat-pill-icon time-icon" />
                  <span className="lb-stat-pill-label">Tổng thời gian</span>
                  <span className="lb-stat-pill-value">{formatTime(user.totalStudyMinutes || 0)}</span>
                </div>
                <div className="lb-stat-pill">
                  <FaFire className="lb-stat-pill-icon fire-icon" />
                  <span className="lb-stat-pill-label">Chuỗi học</span>
                  <span className="lb-stat-pill-value">{user.streak || 0} ngày</span>
                </div>
                <div className="lb-stat-pill">
                  <FaStar className="lb-stat-pill-icon star-icon" />
                  <span className="lb-stat-pill-label">Uy tín</span>
                  <span className="lb-stat-pill-value">{(user.reputation || 5.0).toFixed(1)}</span>
                </div>
              </div>
              {user.badges && user.badges.length > 0 && (
                <div className="lb-my-badges">
                  {user.badges.map((b) => {
                    const { icon, color, label } = getBadgeIcon(b);
                    return (
                      <span key={b} className="lb-badge-pill" style={{ '--badge-color': color }} title={label}>
                        {icon} {label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- Controls: Tabs + Search ---- */}
        <div className="lb-controls animate-fade-in">
          <div className="lb-sort-tabs">
            <button
              type="button"
              className={`lb-tab-btn ${sortBy === 'totalStudyMinutes' ? 'active' : ''}`}
              onClick={() => setSortBy('totalStudyMinutes')}
            >
              <FiClock /> Thời gian học
            </button>
            <button
              type="button"
              className={`lb-tab-btn ${sortBy === 'reputation' ? 'active' : ''}`}
              onClick={() => setSortBy('reputation')}
            >
              <FaStar /> Độ uy tín
            </button>
          </div>

          <div className="lb-search-wrapper">
            <FiSearch className="lb-search-icon" />
            <input
              type="text"
              className="lb-search-input"
              placeholder="Tìm kiếm thành viên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ---- Table ---- */}
        <div className="lb-table-card animate-fade-in-up">
          {loading ? (
            <div className="lb-loading">
              <div className="lb-spinner" />
              Đang tải bảng xếp hạng...
            </div>
          ) : error ? (
            <div className="lb-error" role="alert">
              <FiAward className="lb-empty-icon" />
              <p>{error}</p>
              <button type="button" className="lb-retry-btn" onClick={fetchLeaderboard}>Thử lại</button>
            </div>
          ) : displayUsers.length === 0 ? (
            <div className="lb-empty">
              <FiSearch className="lb-empty-icon" />
              <p>Không tìm thấy thành viên nào.</p>
            </div>
          ) : (
            <table className="lb-table">
              <thead>
                <tr>
                  <th className="lb-th-rank">Hạng</th>
                  <th className="lb-th-member">Thành viên</th>
                  <th className="lb-th-data">
                    <div className="lb-th-inner"><FiClock /> Thời gian</div>
                  </th>
                  <th className="lb-th-data">
                    <div className="lb-th-inner"><FaFire className="col-fire" /> Chuỗi</div>
                  </th>
                  <th className="lb-th-data">
                    <div className="lb-th-inner"><FaStar className="col-star" /> Uy tín</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.map((u, index) => (
                  <tr
                    key={u._id || u.id || index}
                    className={[getRankClass(index), isCurrentUser(u) ? 'is-me' : ''].join(' ').trim()}
                  >
                    {/* Hạng */}
                    <td className="lb-td-rank">
                      {getRankDisplay(index)}
                    </td>

                    {/* Thành viên */}
                    <td className="lb-td-member">
                      <div className="lb-member-inner">
                        <img
                          src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.displayName}`}
                          alt={u.displayName}
                          className="lb-member-avatar"
                        />
                        <div className="lb-member-info">
                          <span className="lb-member-name">{u.displayName || u.username}</span>
                          {u.badges?.length > 0 && (
                            <div className="lb-member-badges">
                              {u.badges.map((b) => {
                                const { icon, color, label } = getBadgeIcon(b);
                                return (
                                  <span
                                    key={b}
                                    className="lb-mini-badge"
                                    style={{ color }}
                                    title={label}
                                  >
                                    {icon}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Thời gian học */}
                    <td className="lb-td-data">
                      {formatTime(u.totalStudyMinutes)}
                    </td>

                    {/* Chuỗi — dùng div bên trong để tránh display:flex trên td */}
                    <td className="lb-td-data">
                      <div className="lb-cell-icon-val">
                        <FaFire className="val-fire" />
                        <span>{u.streak || 0}</span>
                      </div>
                    </td>

                    {/* Uy tín */}
                    <td className="lb-td-data">
                      <div className="lb-cell-icon-val">
                        <FaStar className="val-star" />
                        <span>{u.reputation?.toFixed(1) || '5.0'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
