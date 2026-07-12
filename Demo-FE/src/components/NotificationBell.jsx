import { useState, useRef, useEffect } from 'react';
import { FiBell, FiUserPlus, FiCheck, FiX, FiUserCheck } from 'react-icons/fi';
import { useNotifications } from '../context/notification-context';
import { getSocket } from '../services/socket';
import './NotificationBell.css';

export default function NotificationBell() {
  const { notifications, unreadCount, removeNotification, clearAll, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    markAllRead();
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, markAllRead]);

  const handleRespondFriendRequest = (friendshipId, action) => {
    const socket = getSocket();
    socket.emit('friend:respond', { friendshipId, action });
    removeNotification(friendshipId);
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} giờ trước`;
    return d.toLocaleDateString('vi-VN');
  };

  const renderNotification = (notif) => {
    const avatarSrc = notif.from?.avatar
      || `https://api.dicebear.com/7.x/avataaars/svg?seed=${notif.from?.displayName || notif.from?.username}`;
    const name = notif.from?.displayName || notif.from?.username || 'Người dùng';

    switch (notif.type) {
      case 'friend_request':
        return (
          <div key={notif.id} className="notification-item">
            <img src={avatarSrc} alt="" className="notification-avatar" />
            <div className="notification-content">
              <p><strong>{name}</strong> đã gửi lời mời kết bạn</p>
              <span className="notification-time">{formatTime(notif.createdAt)}</span>
              <div className="notification-actions">
                <button
                  className="notification-accept-btn"
                  onClick={() => handleRespondFriendRequest(notif.id, 'accept')}
                >
                  <FiCheck /> Chấp nhận
                </button>
                <button
                  className="notification-reject-btn"
                  onClick={() => handleRespondFriendRequest(notif.id, 'reject')}
                >
                  <FiX /> Từ chối
                </button>
              </div>
            </div>
          </div>
        );

      case 'friend_accepted':
        return (
          <div key={notif.id} className="notification-item">
            <img src={avatarSrc} alt="" className="notification-avatar" />
            <div className="notification-content">
              <p><FiUserCheck style={{ color: '#51cf66', verticalAlign: 'middle' }} /> <strong>{name}</strong> đã chấp nhận lời mời kết bạn</p>
              <span className="notification-time">{formatTime(notif.createdAt)}</span>
            </div>
          </div>
        );

      case 'room_invitation':
        return (
          <div key={notif.id} className="notification-item">
            <img src={avatarSrc} alt="" className="notification-avatar" />
            <div className="notification-content">
              <p><strong>{name}</strong> mời bạn vào phòng học</p>
              <span className="notification-time">{formatTime(notif.createdAt)}</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        className="bell-btn"
        onClick={() => setOpen(!open)}
        title="Thông báo"
        aria-label="Thông báo"
        aria-expanded={open}
        aria-controls="notification-dropdown"
      >
        <FiBell />
        {unreadCount > 0 && (
          <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown" id="notification-dropdown" role="region" aria-label="Danh sách thông báo">
          <div className="notification-dropdown-header">
            <h4>Thông báo</h4>
            {notifications.length > 0 && (
              <button className="notification-clear-btn" onClick={clearAll}>
                Xóa tất cả
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <FiBell style={{ fontSize: 32, opacity: 0.3 }} />
                <p>Chưa có thông báo</p>
              </div>
            ) : (
              notifications.map(renderNotification)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
