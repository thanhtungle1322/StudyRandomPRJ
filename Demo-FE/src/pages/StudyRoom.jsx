import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket, connectSocket, onSocketEvent } from '../services/socket';
import { FiBook, FiRefreshCw, FiAlertTriangle, FiClock, FiVideo, FiVideoOff, FiMessageSquare, FiSmile, FiInfo, FiSend, FiArrowLeft } from 'react-icons/fi';
import { FaCircle } from 'react-icons/fa';
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
    algorithm: 'Thuật toán', physics: 'Vật lý', triet: 'Triết học',
    lichsu: 'Lịch sử', diali: 'Địa lí',
  };

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      const socket = getSocket();
      socket.emit('join_room', { roomId });
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
  }, [roomId, addSystemMessage]);

  useEffect(() => {
    const socket = connectSocket();

    socket.emit('join_room', { roomId });

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

    socket.on('auto_disconnect_warning', (data) => {
      setAutoDisconnectWarning(data.message);
      setCountdown(data.countdown / 1000);

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
      setTimeout(() => navigate('/lobby'), 2000);
    });

    socket.on('room_data', (room) => {
      setSubject(room.subject);
      if (room.messages) setMessages(room.messages);
    });

    socket.on('room_error', () => {
      navigate('/lobby');
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

      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [roomId, navigate, addSystemMessage]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const socket = getSocket();
    socket.emit('send_message', {
      roomId,
      message: newMessage.trim(),
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

  const isOwnMessage = (msg) => {
    if (msg.isSystem) return false;
    if (msg.userId && user?.id) return msg.userId === user.id;
    return msg.user?.id === user?.id;
  };

  return (
    <div className="study-room">
      <div className="room-header">
        <div className="room-header-left">
          <button onClick={handleLeaveRoom} className="btn btn-sm btn-secondary room-back-btn">
            <FiArrowLeft /> Rời phòng
          </button>
          <div className="room-info">
            <h2>Phòng Học</h2>
            <span className="room-subject-badge">
              <FiBook style={{ color: '#845ef7' }} /> {subjectNames[subject] || subject}
            </span>
          </div>
        </div>
        <div className="room-header-right">
          {reconnecting && (
            <span className="connection-status reconnecting"><FiRefreshCw style={{ color: '#fcc419' }} /> Đang kết nối lại...</span>
          )}
          {!connected && !reconnecting && (
            <span className="connection-status disconnected"><FiAlertTriangle style={{ color: '#ff6b6b' }} /> Mất kết nối</span>
          )}
          {connected && !partnerLeft && (
            <span className="connection-status connected"><FaCircle style={{ fontSize: 8, color: '#51cf66' }} /> Đang kết nối</span>
          )}
          {connected && partnerLeft && (
            <span className="connection-status disconnected"><FaCircle style={{ fontSize: 8, color: '#fcc419' }} /> Partner rời phòng</span>
          )}
        </div>
      </div>

      {autoDisconnectWarning && (
        <div className="auto-disconnect-banner animate-fade-in">
          <span className="banner-icon"><FiClock style={{ color: '#ff922b' }} /></span>
          <span className="banner-text">
            {autoDisconnectWarning}
          </span>
          <span className="banner-countdown">{countdown}s</span>
        </div>
      )}

      <div className="room-body">
        <div className="room-sidebar">
          <div className="partner-card glass-card">
            <h3>Bạn Học Của Bạn</h3>
            {partner ? (
              <div className="partner-info">
                <img
                  src={partner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.username}`}
                  alt={partner.username}
                  className="partner-avatar"
                  onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(partner?.username || '')}`; }}
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

          <div className="video-placeholder glass-card">
            <div className="video-coming-soon">
              <span className="video-icon"><FiVideo style={{ color: '#339af0' }} /></span>
              <h4>Video Call</h4>
              <p>Tính năng đang phát triển</p>
              <button className="btn btn-sm btn-secondary" disabled>
                <FiVideoOff /> Bật Camera (Coming Soon)
              </button>
            </div>
          </div>

          <div className="self-card glass-card">
            <div className="self-info">
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName}`}
                alt="You"
                className="self-avatar"
                onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.displayName || '')}`; }}
              />
              <div>
                <span className="self-name">{user?.displayName}</span>
                <span className="self-label">Bạn</span>
              </div>
            </div>
          </div>
        </div>

        <div className="chat-area glass-card">
          <div className="chat-header">
            <h3><FiMessageSquare style={{ color: '#51cf66' }} /> Chat</h3>
            <span className="message-count">{messages.length} tin nhắn</span>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                <span className="chat-empty-icon"><FiSmile style={{ color: '#fcc419' }} /></span>
                <p>Hãy gửi lời chào đến bạn học!</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message ${
                  msg.isSystem
                    ? 'message-system'
                    : isOwnMessage(msg)
                    ? 'message-self'
                    : 'message-other'
                }`}
              >
                {msg.isSystem ? (
                  <div className="system-message">
                    <span><FiInfo style={{ color: '#339af0' }} /></span> {msg.text}
                  </div>
                ) : (
                  <>
                    {!isOwnMessage(msg) && (
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
              Gửi <FiSend style={{ color: '#fcc419' }} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
