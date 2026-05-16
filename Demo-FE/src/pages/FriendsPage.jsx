import { Link } from 'react-router-dom';
import './StaticPages.css';

export default function FriendsPage() {
  const demoFriends = [
    { id: 1, name: 'Nguyễn Văn A', status: 'online', subject: 'Toán học', avatar: '👨‍🎓' },
    { id: 2, name: 'Trần Thị B', status: 'offline', subject: 'Tiếng Anh', avatar: '👩‍🎓' },
    { id: 3, name: 'Lê Minh C', status: 'online', subject: 'Lập trình Python', avatar: '🧑‍💻' },
    { id: 4, name: 'Phạm Hương D', status: 'studying', subject: 'React / Frontend', avatar: '👩‍💻' },
    { id: 5, name: 'Hoàng Đức E', status: 'offline', subject: 'Thuật toán', avatar: '🧑‍🔬' },
  ];

  const statusLabels = {
    online: '🟢 Online',
    offline: '⚫ Offline',
    studying: '📚 Đang học',
  };

  return (
    <div className="static-page">
      <div className="container">
        <div className="static-header animate-fade-in">
          <span className="static-icon">👥</span>
          <h1>Danh Sách Bạn Bè</h1>
          <p className="static-subtitle">
            Quản lý bạn bè và mời họ học cùng bạn bất cứ lúc nào
          </p>
        </div>

        <div className="static-content animate-fade-in-up">
          {/* Friends List */}
          <div className="friends-list">
            {demoFriends.map((friend) => (
              <div key={friend.id} className="friend-card glass-card">
                <div className="friend-info">
                  <span className="friend-avatar-emoji">{friend.avatar}</span>
                  <div className="friend-details">
                    <h3>{friend.name}</h3>
                    <p className="friend-subject">🎯 {friend.subject}</p>
                  </div>
                </div>
                <div className="friend-actions">
                  <span className={`friend-status ${friend.status}`}>
                    {statusLabels[friend.status]}
                  </span>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={friend.status === 'offline'}
                  >
                    📩 Mời học
                  </button>
                  <button className="btn btn-sm btn-secondary">⋯</button>
                </div>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <div className="feature-list">
            <div className="feature-item glass-card">
              <span className="feature-emoji">➕</span>
              <div>
                <h3>Thêm bạn bè</h3>
                <p>Sau khi học cùng ai đó, bạn có thể gửi lời mời kết bạn</p>
              </div>
            </div>
            <div className="feature-item glass-card">
              <span className="feature-emoji">📩</span>
              <div>
                <h3>Mời học trực tiếp</h3>
                <p>Mời bạn bè đang online vào phòng học chung ngay lập tức</p>
              </div>
            </div>
            <div className="feature-item glass-card">
              <span className="feature-emoji">📊</span>
              <div>
                <h3>Lịch sử học</h3>
                <p>Xem thống kê thời gian học cùng từng người bạn</p>
              </div>
            </div>
          </div>

          <div className="static-notice glass-card">
            <span>🚧</span>
            <p>
              <strong>Tính năng đang phát triển.</strong> Hệ thống kết bạn và mời 
              học sẽ được hoàn thiện trong phiên bản tiếp theo.
            </p>
          </div>

          <div className="static-cta">
            <Link to="/lobby" className="btn btn-primary btn-lg">
              ← Quay lại Sảnh chờ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
