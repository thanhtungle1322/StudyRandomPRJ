import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket, connectSocket, onSocketEvent } from '../services/socket';
import './StudyRoom.css';

export default function StudyRoom() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [partner, setPartner] = useState(location.state?.partner || null);
  const [subject, setSubject] = useState(location.state?.subject || '');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [connected, setConnected] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [autoDisconnectWarning, setAutoDisconnectWarning] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const countdownRef = useRef(null);

  const subjectNames = {
    math: 'Toán học', nodejs: 'Lập trình NodeJS', english: 'Tiếng Anh',
    python: 'Lập trình Python', react: 'React / Frontend', database: 'Cơ sở dữ liệu',
    algorithm: 'Thuật toán', physics: 'Vật lý',
  };

  // Thêm system message helper
  const addSystemMessage = useCallback((text) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        text,
        user: { username: 'Hệ thống' },
        isSystem: true,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ========================
  // Observer: Subscribe to socket lifecycle events
  // ========================
  useEffect(() => {
    const unsub1 = onSocketEvent('disconnected', ({ reason }) => {
      setConnected(false);
      setReconnecting(true);
      addSystemMessage(`Mất kết nối (${reason}). Đang thử kết nối lại...`);
    });

    const unsub2 = onSocketEvent('reconnected', () => {
      setConnected(true);
      setReconnecting(false);
      addSystemMessage('Đã kết nối lại thành công!');

      // Rejoin room sau reconnect
      const socket = getSocket();
      socket.emit('join_room', { roomId, user });
    });

    const unsub3 = onSocketEvent('reconnect_failed', () => {
      setReconnecting(false);
      addSystemMessage('Không thể kết nối lại. Vui lòng tải lại trang.');
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [roomId, user, addSystemMessage]);

  // ========================
  // Socket events cho room
  // ========================
  useEffect(() => {
    const socket = connectSocket();

    // Join room (gửi user info cho reconnect support)
    socket.emit('join_room', { roomId, user });

    socket.on('new_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('partner_left', (data) => {
      setPartnerLeft(true);
      addSystemMessage(data.message || 'Bạn học đã rời phòng');
    });

    socket.on('partner_reconnected', (data) => {
      setPartnerLeft(false);
      setAutoDisconnectWarning(null);
      setCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      addSystemMessage(data.message || 'Bạn học đã kết nối lại!');
    });

    // === AUTO-DISCONNECT EVENTS ===

    socket.on('auto_disconnect_warning', (data) => {
      setAutoDisconnectWarning(data.message);
      setCountdown(data.countdown / 1000);

      // Bắt đầu đếm ngược
      if (countdownRef.current) clearInterval(countdownRef.current);
      let remaining = data.countdown / 1000;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(Math.max(0, remaining));
        if (remaining <= 0) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }, 1000);
    });

    socket.on('auto_disconnect_cancelled', (data) => {
      setAutoDisconnectWarning(null);
      setCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      addSystemMessage(data.message || 'Auto-disconnect đã hủy');
    });

    socket.on('room_auto_closed', (data) => {
      setAutoDisconnectWarning(null);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      addSystemMessage(data.message || 'Phòng đã tự động đóng');
      // Redirect sau 2s
      setTimeout(() => navigate('/lobby'), 2000);
    });

    socket.on('room_data', (room) => {
      setSubject(room.subject);
      if (room.messages) setMessages(room.messages);
    });

    socket.on('room_error', () => {
      navigate('/lobby');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
      socket.emit('join_room', { roomId, user });
    });

    return () => {
      socket.off('new_message');
      socket.off('partner_left');
      socket.off('partner_reconnected');
      socket.off('auto_disconnect_warning');
      socket.off('auto_disconnect_cancelled');
      socket.off('room_auto_closed');
      socket.off('room_data');
      socket.off('room_error');
      socket.off('disconnect');
      socket.off('connect');

      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [roomId, navigate, user, addSystemMessage]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const socket = getSocket();
    socket.emit('send_message', {
      roomId,
      message: newMessage.trim(),
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
      },
    });

    setNewMessage('');
    chatInputRef.current?.focus();
  };

  const handleLeaveRoom = () => {
    const socket = getSocket();
    socket.emit('leave_room', { roomId });
    navigate('/lobby');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="study-room">
      {/* Room Header */}
      <div className="room-header">
        <div className="room-header-left">
          <button onClick={handleLeaveRoom} className="btn btn-sm btn-secondary room-back-btn">
            ← Rời phòng
          </button>
          <div className="room-info">
            <h2>Phòng Học</h2>
            <span className="room-subject-badge">
              📚 {subjectNames[subject] || subject}
            </span>
          </div>
        </div>
        <div className="room-header-right">
          {reconnecting && (
            <span className="connection-status reconnecting">🔄 Đang kết nối lại...</span>
          )}
          {!connected && !reconnecting && (
            <span className="connection-status disconnected">⚠️ Mất kết nối</span>
          )}
          {connected && !partnerLeft && (
            <span className="connection-status connected">🟢 Đang kết nối</span>
          )}
          {connected && partnerLeft && (
            <span className="connection-status disconnected">🟡 Partner rời phòng</span>
          )}
        </div>
      </div>

      {/* Auto-Disconnect Warning Banner */}
      {autoDisconnectWarning && (
        <div className="auto-disconnect-banner animate-fade-in">
          <span className="banner-icon">⏱️</span>
          <span className="banner-text">
            {autoDisconnectWarning}
          </span>
          <span className="banner-countdown">{countdown}s</span>
        </div>
      )}

      {/* Room Body */}
      <div className="room-body">
        {/* Partner Info / Video Area */}
        <div className="room-sidebar">
          {/* Partner Card */}
          <div className="partner-card glass-card">
            <h3>Bạn Học Của Bạn</h3>
            {partner ? (
              <div className="partner-info">
                <img
                  src={partner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.username}`}
                  alt={partner.username}
                  className="partner-avatar"
                />
                <span className="partner-name">{partner.username}</span>
                {partnerLeft ? (
                  <span className="partner-status offline">Đã rời phòng</span>
                ) : (
                  <span className="partner-status online">Đang online</span>
                )}
              </div>
            ) : (
              <p className="no-partner">Đang kết nối...</p>
            )}
          </div>

          {/* Video Placeholder */}
          <div className="video-placeholder glass-card">
            <div className="video-coming-soon">
              <span className="video-icon">🎥</span>
              <h4>Video Call</h4>
              <p>Tính năng đang phát triển</p>
              <button className="btn btn-sm btn-secondary" disabled>
                📹 Bật Camera (Coming Soon)
              </button>
            </div>
          </div>

          {/* Your Info */}
          <div className="self-card glass-card">
            <div className="self-info">
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                alt="You"
                className="self-avatar"
              />
              <div>
                <span className="self-name">{user?.username}</span>
                <span className="self-label">Bạn</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-area glass-card">
          <div className="chat-header">
            <h3>💬 Chat</h3>
            <span className="message-count">{messages.length} tin nhắn</span>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                <span className="chat-empty-icon">👋</span>
                <p>Hãy gửi lời chào đến bạn học!</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message ${
                  msg.isSystem
                    ? 'message-system'
                    : msg.user?.id === user?.id
                    ? 'message-self'
                    : 'message-other'
                }`}
              >
                {msg.isSystem ? (
                  <div className="system-message">
                    <span>ℹ️</span> {msg.text}
                  </div>
                ) : (
                  <>
                    {msg.user?.id !== user?.id && (
                      <span className="message-author">{msg.user?.username}</span>
                    )}
                    <div className="message-bubble">
                      <p>{msg.text}</p>
                      <span className="message-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="chat-input-form">
            <input
              ref={chatInputRef}
              type="text"
              className="input-field chat-input"
              placeholder="Nhập tin nhắn..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={partnerLeft}
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-primary send-btn"
              disabled={!newMessage.trim() || partnerLeft}
            >
              Gửi ➤
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
