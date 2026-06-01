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
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState({}); // { [userId]: 'sending' | 'sent' | 'error' }

  const handleSearchUsers = async (val) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(val)}`);
      if (data.success) {
        setSearchResults(data.users);
      }
    } catch (err) {
      console.error('Failed to search users:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendFriendRequest = async (recipientId) => {
    setActionStatus((prev) => ({ ...prev, [recipientId]: 'sending' }));
    try {
      const { data } = await api.post('/friends/request', { recipientId });
      if (data.success) {
        setActionStatus((prev) => ({ ...prev, [recipientId]: 'sent' }));
      }
    } catch (err) {
      console.error('Failed to send friend request:', err);
      setActionStatus((prev) => ({ ...prev, [recipientId]: 'error' }));
      alert(err.response?.data?.message || 'Không thể gửi lời mời kết bạn');
    }
  };

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

  const fetchPendingRequests = useCallback(async () => {
    try {
      setPendingLoading(true);
      const { data } = await api.get('/friends/pending');
      if (data.success) {
        setPendingRequests(data.requests);
      }
    } catch (err) {
      console.error('Failed to fetch pending requests:', err);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const handleRespondRequest = async (friendshipId, action) => {
    try {
      const { data } = await api.put('/friends/respond', { friendshipId, action });
      if (data.success) {
        setPendingRequests(prev => prev.filter(r => r.friendshipId !== friendshipId));
        if (action === 'accept') {
          fetchFriends();
        }
      }
    } catch (err) {
      console.error('Failed to respond to friend request:', err);
      alert('Không thể thực hiện thao tác.');
    }
  };

  useEffect(() => {
    fetchFriends();
    fetchPendingRequests();
  }, [fetchFriends, fetchPendingRequests]);

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
      setInviteSuccess(null);
    };

    const handleInviteSent = (data) => {
      setInvitingId(null);
      setInviteSuccess(data.friendId);
    };

    const handleInvitationRejected = (data) => {
      alert(`${data.friendName} đã từ chối lời mời học.`);
      setInviteSuccess(null);
    };

    socket.on('friend:request_accepted', handleFriendAccepted);
    socket.on('room:invitation_accepted', handleInvitationAccepted);
    socket.on('room:invite_error', handleInviteError);
    socket.on('room:invite_sent', handleInviteSent);
    socket.on('room:invitation_rejected', handleInvitationRejected);

    return () => {
      socket.off('friend:request_accepted', handleFriendAccepted);
      socket.off('room:invitation_accepted', handleInvitationAccepted);
      socket.off('room:invite_error', handleInviteError);
      socket.off('room:invite_sent', handleInviteSent);
      socket.off('room:invitation_rejected', handleInvitationRejected);
    };
  }, [navigate, fetchFriends]);

  const handleInviteToStudy = (friend, subject) => {
    const socket = getSocket();
    const friendId = friend.user._id;
    setInvitingId(friendId);
    socket.emit('room:invite', { friendId, subject });
    setShowSubjectPicker(null);
    // Don't auto-reset — wait for room:invite_sent or room:invite_error
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

          {/* Features & Search Column */}
          <div className="friends-features">
            {/* Pending Friend Requests Panel */}
            <div className="friends-pending-panel animate-fade-in" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '16px', color: '#fff' }}>
                ✉️ Lời mời kết bạn đang chờ ({pendingRequests.length})
              </h3>
              
              {pendingLoading && (
                <div style={{ textAlign: 'center', padding: '10px', fontSize: '13px', opacity: 0.6 }}>
                  <FiLoader className="spin-icon animate-spin" /> Đang tải lời mời...
                </div>
              )}

              {!pendingLoading && pendingRequests.length === 0 && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                  Không có lời mời kết bạn nào đang chờ phản hồi.
                </p>
              )}

              <div className="pending-requests-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                {!pendingLoading && pendingRequests.map((req) => {
                  const avatarSrc = req.requester.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.requester.displayName}`;
                  
                  return (
                    <div key={req.friendshipId} className="friend-card-new" style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)', gap: '8px', minHeight: 'auto' }}>
                      <div className="friend-avatar" style={{ width: '36px', height: '36px', minWidth: '36px' }}>
                        <img src={avatarSrc} alt="" className="friend-avatar-img" />
                      </div>
                      
                      <div className="friend-details" style={{ flex: 1 }}>
                        <h4 className="friend-name" style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: '#fff' }}>
                          {req.requester.displayName}
                        </h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                          @{req.requester.displayName?.split(' ')[0] || 'user'}
                        </p>
                      </div>

                      <div className="friend-actions-new" style={{ padding: 0, gap: '4px', display: 'flex' }}>
                        <button
                          className="btn-friend-invite"
                          style={{ padding: '4px 8px', fontSize: '11px', height: 'auto', background: '#51cf66', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
                          onClick={() => handleRespondRequest(req.friendshipId, 'accept')}
                          title="Đồng ý"
                        >
                          <FiCheck /> Nhận
                        </button>
                        <button
                          className="btn-cancel-pick"
                          style={{ padding: '4px 8px', fontSize: '11px', height: 'auto', background: 'rgba(255,107,107,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.3)', display: 'flex', alignItems: 'center', gap: '2px', borderRadius: '4px' }}
                          onClick={() => handleRespondRequest(req.friendshipId, 'reject')}
                          title="Từ chối"
                        >
                          <FiUserX />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dedicated Search Panel */}
            <div className="friends-search-panel animate-fade-in" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '16px', color: '#fff' }}>
                🔍 Tìm bạn học mới
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Nhập tên hiển thị hoặc biệt danh để tìm kiếm và kết bạn.
              </p>
              
              <input
                type="text"
                className="input-field"
                placeholder="VD: Nguyễn Văn A..."
                value={searchQuery}
                onChange={(e) => handleSearchUsers(e.target.value)}
                style={{ width: '100%', marginBottom: '16px' }}
              />

              {/* Search Results list */}
              <div className="search-results-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                {searchLoading && (
                  <div style={{ textAlign: 'center', padding: '10px', fontSize: '13px', opacity: 0.6 }}>
                    <FiLoader className="spin-icon animate-spin" /> Đang tìm kiếm...
                  </div>
                )}

                {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '10px', fontSize: '13px', opacity: 0.6 }}>
                    Không tìm thấy người dùng nào.
                  </div>
                )}

                {!searchLoading && searchResults.map((usr) => {
                  const status = actionStatus[usr._id];
                  const avatarSrc = usr.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${usr.displayName}`;
                  
                  return (
                    <div key={usr._id} className="friend-card-new" style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)', gap: '8px', minHeight: 'auto' }}>
                      <div className="friend-avatar" style={{ width: '36px', height: '36px', minWidth: '36px' }}>
                        <img src={avatarSrc} alt="" className="friend-avatar-img" />
                      </div>
                      
                      <div className="friend-details" style={{ flex: 1 }}>
                        <h4 className="friend-name" style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: '#fff' }}>
                          {usr.displayName}
                        </h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                          @{usr.email?.split('@')[0]}
                        </p>
                      </div>

                      <div className="friend-actions-new" style={{ padding: 0 }}>
                        {status === 'sent' ? (
                          <span style={{ fontSize: '11px', color: '#51cf66', background: 'rgba(81,207,102,0.15)', padding: '4px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <FiCheck /> Đã gửi
                          </span>
                        ) : (
                          <button
                            className="btn-friend-invite"
                            style={{ padding: '4px 10px', fontSize: '11px', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                            disabled={status === 'sending'}
                            onClick={() => handleSendFriendRequest(usr._id)}
                          >
                            {status === 'sending' ? (
                              <FiLoader className="spin-icon animate-spin" />
                            ) : (
                              <><FiPlusCircle /> Kết bạn</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
