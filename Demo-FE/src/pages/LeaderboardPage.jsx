import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './StaticPages.css';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [sortBy, setSortBy] = useState('totalStudyMinutes'); // totalStudyMinutes, reputation
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${apiUrl}/users/leaderboard?sortBy=${sortBy}&limit=20`);
        const data = await res.json();
        if (data.success) {
          setUsers(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeaderboard();
  }, [sortBy]);

  const formatTime = (minutes) => {
    if (!minutes) return '0 phút';
    if (minutes < 60) return `${minutes} phút`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getBadgeIcon = (badge) => {
    switch(badge) {
      case 'FIRST_STEP': return '👶';
      case 'DEDICATED': return '🔥';
      case 'WEEK_STREAK': return '⚡';
      default: return '🏅';
    }
  };

  const getBadgeName = (badge) => {
    switch(badge) {
      case 'FIRST_STEP': return 'Người mới bắt đầu';
      case 'DEDICATED': return 'Chăm chỉ (10h+)';
      case 'WEEK_STREAK': return 'Chuỗi 7 ngày';
      default: return 'Huy hiệu';
    }
  };

  return (
    <div className="static-page">
      <div className="container" style={{ maxWidth: '800px' }}>
        <div className="static-header animate-fade-in">
          <span className="static-icon">🏆</span>
          <h1>Bảng Xếp Hạng</h1>
          <p className="static-subtitle">
            Cùng thi đua học tập với cộng đồng StudyRandom
          </p>
        </div>

        <div className="static-content animate-fade-in-up">
          {/* User Stats Card */}
          {user && (
            <div className="glass-card" style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '20px', padding: '24px' }}>
              <img src={user.avatar} alt="You" style={{ width: 80, height: 80, borderRadius: '50%', background: 'white' }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Thành tích của bạn: {user.username}</h3>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>Tổng thời gian</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatTime(user.totalStudyMinutes || 0)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>Chuỗi học</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{user.streak || 0} ngày 🔥</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>Uy tín</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{user.reputation || 5.0} ⭐</div>
                  </div>
                </div>
                
                {user.badges && user.badges.length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    {user.badges.map(b => (
                      <span key={b} title={getBadgeName(b)} style={{ background: 'rgba(255,215,0,0.2)', border: '1px solid gold', padding: '4px 10px', borderRadius: '20px', fontSize: '14px' }}>
                        {getBadgeIcon(b)} {getBadgeName(b)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button 
              className={`btn ${sortBy === 'totalStudyMinutes' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSortBy('totalStudyMinutes')}
            >
              ⏱️ Thời gian học
            </button>
            <button 
              className={`btn ${sortBy === 'reputation' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSortBy('reputation')}
            >
              ⭐ Độ uy tín
            </button>
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>Đang tải bảng xếp hạng...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '16px 20px', width: '60px' }}>Hạng</th>
                    <th style={{ padding: '16px 20px' }}>Thành viên</th>
                    <th style={{ padding: '16px 20px' }}>Thời gian học</th>
                    <th style={{ padding: '16px 20px' }}>Chuỗi</th>
                    <th style={{ padding: '16px 20px' }}>Uy tín</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, index) => (
                    <tr key={u._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: user && (user.id === u._id || user.dbId === u._id) ? 'rgba(99, 102, 241, 0.1)' : 'transparent' }}>
                      <td style={{ padding: '16px 20px', fontSize: '18px', fontWeight: 'bold', color: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'white' }}>
                        #{index + 1}
                      </td>
                      <td style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={u.avatar} alt={u.username} style={{ width: 40, height: 40, borderRadius: '50%', background: 'white' }} />
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{u.username}</div>
                          <div style={{ fontSize: '12px', display: 'flex', gap: '4px', marginTop: '4px' }}>
                            {u.badges?.map(b => (
                              <span key={b} title={getBadgeName(b)}>{getBadgeIcon(b)}</span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>{formatTime(u.totalStudyMinutes)}</td>
                      <td style={{ padding: '16px 20px' }}>{u.streak || 0} 🔥</td>
                      <td style={{ padding: '16px 20px' }}>{u.reputation?.toFixed(1) || '5.0'} ⭐</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
