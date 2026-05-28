import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUsers, FiCrosshair, FiMail, FiPlusCircle, FiBarChart2, FiAlertCircle, FiArrowLeft, FiMoreHorizontal, FiUser, FiLoader, FiUserX, FiCheck } from 'react-icons/fi';
import { FaCircle } from 'react-icons/fa';
import { getSocket, connectSocket } from '../services/socket';
import api from '../services/api';
import backgroundDashboard from '../../background/backgroundDashboard.png';
import './FriendsPage.css';

const subjectNames = {
  math: 'Toán học', nodejs: 'Lập trình NodeJS', english: 'Tiếng Anh',
  python: 'Lập trình Python', react: 'React / Frontend', database: 'Cơ sở dữ liệu',
  algorithm: 'Thuật toán', physics: 'Vật lý', triet: 'Triết học',
  lichsu: 'Lịch sử', diali: 'Địa lí',
};

export default function FriendsPage() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invitingId, setInvitingId] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [showSubjectPicker, setShowSubjectPicker] = useState(null); // friendId

  const statusConfig = {
    online:   { label: 'Online',    color: '#51cf66', bg: 'rgba(81,207,102,0.18)'  },
    offline:  { label: 'Offline',   color: '#adb5bd', bg: 'rgba(255,255,255,0.08)' },
    studying: { label: 'Đang học',  color: '#74c0fc', bg: 'rgba(116,192,252,0.18)' },
  };

  const fetchFriends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/friends');
      if (data.success) {
        setFriends(data.friends);
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err);
      setError('Không thể tải danh sách bạn bè');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Listen for real-time friend updates
  useEffect(() => {
    const socket = connectSocket();

    const handleFriendAccepted = () => {
      fetchFriends(); // Refresh list when someone accepts
    };

    const handleInvitationAccepted = (data) => {
      if (data.roomId) {
        navigate(`/room/${data.roomId}`, {
          state: { subject: data.subject, partner: data.partner },
        });
      }
    };

    const handleInviteError = (data) => {
      alert(data.message || 'Lỗi khi mời bạn học');
      setInvitingId(null);
    };

    socket.on('friend:request_accepted', handleFriendAccepted);
    socket.on('room:invitation_accepted', handleInvitationAccepted);
    socket.on('room:invite_error', handleInviteError);

    return () => {
      socket.off('friend:request_accepted', handleFriendAccepted);
      socket.off('room:invitation_accepted', handleInvitationAccepted);
      socket.off('room:invite_error', handleInviteError);
    };
  }, [navigate, fetchFriends]);

  const handleInviteToStudy = (friend, subject) => {
    const socket = getSocket();
    const friendId = friend.user._id;
    setInvitingId(friendId);
    socket.emit('room:invite', { friendId, subject });
    setShowSubjectPicker(null);

    // Show success temporarily
    setInviteSuccess(friendId);
    setTimeout(() => {
      setInvitingId(null);
      setInviteSuccess(null);
    }, 3000);
  };

  const handleRemoveFriend = async (friendshipId) => {
    if (!confirm('Bạn có chắc muốn hủy kết bạn?')) return;
    try {
      await api.delete(`/friends/${friendshipId}`);
      setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId));
    } catch (err) {
      console.error('Failed to remove friend:', err);
      alert('Không thể hủy kết bạn');
    }
  };

  const getStatus = (friend) => {
    if (friend.user.isOnline) return 'online';
    return 'offline';
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
            {loading && (
              <div className="friends-loading">
                <FiLoader className="spin-icon" /> Đang tải danh sách bạn bè...
              </div>
            )}

            {error && (
              <div className="friends-error">
                <FiAlertCircle /> {error}
                <button onClick={fetchFriends} className="btn-retry">Thử lại</button>
              </div>
            )}

            {!loading && !error && friends.length === 0 && (
              <div className="friends-empty">
                <span className="friends-empty-icon">😢</span>
                <h3>Chưa có bạn bè nào</h3>
                <p>Hãy vào phòng học và kết bạn với những người học cùng!</p>
                <Link to="/lobby" className="btn-back-lobby">
                  <FiArrowLeft /> Vào Sảnh chờ để học
                </Link>
              </div>
            )}

            {!loading && friends.map((friend) => {
              const status = getStatus(friend);
              const sc = statusConfig[status];
              const avatarSrc = friend.user.avatar
                || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.user.displayName}`;

              return (
                <div key={friend.friendshipId} className="friend-card-new">
                  {/* Avatar */}
                  <div className="friend-avatar">
                    {friend.user.avatar ? (
                      <img src={avatarSrc} alt="" className="friend-avatar-img" />
                    ) : (
                      <FiUser />
                    )}
                  </div>

                  {/* Info */}
                  <div className="friend-details">
                    <h3 className="friend-name">{friend.user.displayName}</h3>
                    {friend.user.lastSeen && (
                      <p className="friend-last-seen">
                        {friend.user.isOnline
                          ? 'Đang online'
                          : `Hoạt động ${new Date(friend.user.lastSeen).toLocaleDateString('vi-VN')}`}
                      </p>
                    )}
                  </div>

                  {/* Status + Actions */}
                  <div className="friend-actions-new">
                    <span
                      className="friend-status-badge"
                      style={{ color: sc.color, background: sc.bg }}
                    >
                      <FaCircle style={{ fontSize: 7 }} /> {sc.label}
                    </span>

                    {inviteSuccess === friend.user._id ? (
                      <span className="btn-friend-invite-sent">
                        <FiCheck /> Đã gửi lời mời
                      </span>
                    ) : showSubjectPicker === friend.user._id ? (
                      <div className="subject-picker-inline">
                        <select
                          className="subject-select"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleInviteToStudy(friend, e.target.value);
                            }
                          }}
                        >
                          <option value="" disabled>Chọn môn học...</option>
                          {Object.entries(subjectNames).map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                          ))}
                        </select>
                        <button
                          className="btn-cancel-pick"
                          onClick={() => setShowSubjectPicker(null)}
                        >
                          <FiUserX />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-friend-invite"
                        disabled={!friend.user.isOnline || invitingId === friend.user._id}
                        onClick={() => setShowSubjectPicker(friend.user._id)}
                      >
                        {invitingId === friend.user._id ? (
                          <><FiLoader className="spin-icon" /> Đang mời...</>
                        ) : (
                          <><FiMail /> Mời học</>
                        )}
                      </button>
                    )}

                    <button
                      className="btn-friend-more"
                      onClick={() => handleRemoveFriend(friend.friendshipId)}
                      title="Hủy kết bạn"
                    >
                      <FiUserX />
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
