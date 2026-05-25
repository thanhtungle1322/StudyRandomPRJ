import { Link } from 'react-router-dom';
import { FiUsers, FiCrosshair, FiMail, FiPlusCircle, FiBarChart2, FiAlertCircle, FiArrowLeft, FiMoreHorizontal, FiUser } from 'react-icons/fi';
import { FaCircle } from 'react-icons/fa';
import backgroundDashboard from '../../background/backgroundDashboard.png';
import './FriendsPage.css';

export default function FriendsPage() {
  const demoFriends = [
    { id: 1, name: 'Nguyễn Văn A', status: 'online',   subject: 'Toán học' },
    { id: 2, name: 'Trần Thị B',   status: 'offline',  subject: 'Tiếng Anh' },
    { id: 3, name: 'Lê Minh C',    status: 'online',   subject: 'Lập trình Python' },
    { id: 4, name: 'Phạm Hương D', status: 'studying', subject: 'React / Frontend' },
    { id: 5, name: 'Hoàng Đức E',  status: 'offline',  subject: 'Thuật toán' },
  ];

  const statusConfig = {
    online:   { label: 'Online',    color: '#51cf66', bg: 'rgba(81,207,102,0.18)'  },
    offline:  { label: 'Offline',   color: '#adb5bd', bg: 'rgba(255,255,255,0.08)' },
    studying: { label: 'Đang học',  color: '#74c0fc', bg: 'rgba(116,192,252,0.18)' },
  };

  return (
    <div className="friends-page" style={{ backgroundImage: `url(${backgroundDashboard})` }}>
      <div className="friends-overlay" />

      <div className="container friends-container">
        {/* Header */}
        <div className="friends-header animate-fade-in">
          <span className="friends-header-icon">👥</span>
          <h1>Danh Sách Bạn Bè</h1>
          <p>Quản lý bạn bè và mời họ học cùng bạn bất cứ lúc nào</p>
        </div>

        <div className="friends-body animate-fade-in-up">
          {/* Friend list */}
          <div className="friends-list">
            {demoFriends.map((friend) => {
              const sc = statusConfig[friend.status];
              return (
                <div key={friend.id} className="friend-card-new">
                  {/* Avatar */}
                  <div className="friend-avatar">
                    <FiUser />
                  </div>

                  {/* Info */}
                  <div className="friend-details">
                    <h3 className="friend-name">{friend.name}</h3>
                    <p className="friend-subject">
                      <FiCrosshair style={{ color: '#74c0fc', verticalAlign: 'middle' }} /> {friend.subject}
                    </p>
                  </div>

                  {/* Status + Actions */}
                  <div className="friend-actions-new">
                    <span
                      className="friend-status-badge"
                      style={{ color: sc.color, background: sc.bg }}
                    >
                      <FaCircle style={{ fontSize: 7 }} /> {sc.label}
                    </span>
                    <button
                      className="btn-friend-invite"
                      disabled={friend.status === 'offline'}
                    >
                      <FiMail /> Mời học
                    </button>
                    <button className="btn-friend-more">
                      <FiMoreHorizontal />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Features */}
          <div className="friends-features">
            <div className="friends-feature-card">
              <span className="friends-feature-icon" style={{ background: 'rgba(81,207,102,0.2)', color: '#51cf66' }}>
                <FiPlusCircle />
              </span>
              <div>
                <h3>Thêm bạn bè</h3>
                <p>Sau khi học cùng ai đó, bạn có thể gửi lời mời kết bạn</p>
              </div>
            </div>
            <div className="friends-feature-card">
              <span className="friends-feature-icon" style={{ background: 'rgba(116,192,252,0.2)', color: '#74c0fc' }}>
                <FiMail />
              </span>
              <div>
                <h3>Mời học trực tiếp</h3>
                <p>Mời bạn bè đang online vào phòng học chung ngay lập tức</p>
              </div>
            </div>
            <div className="friends-feature-card">
              <span className="friends-feature-icon" style={{ background: 'rgba(196,153,255,0.2)', color: '#c49dff' }}>
                <FiBarChart2 />
              </span>
              <div>
                <h3>Lịch sử học</h3>
                <p>Xem thống kê thời gian học cùng từng người bạn</p>
              </div>
            </div>
          </div>

          {/* Notice */}
          <div className="friends-notice">
            <FiAlertCircle style={{ color: '#ffa94d', fontSize: 20, flexShrink: 0 }} />
            <p>
              <strong>Tính năng đang phát triển.</strong> Hệ thống kết bạn và mời
              học sẽ được hoàn thiện trong phiên bản tiếp theo.
            </p>
          </div>

          {/* CTA */}
          <div className="friends-cta">
            <Link to="/lobby" className="btn-back-lobby">
              <FiArrowLeft /> Quay lại Sảnh chờ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
