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

  const [partner] = useState(location.state?.partner || null);
  const [subject, setSubject] = useState(location.state?.subject || '');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [connected, setConnected] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [autoDisconnectWarning, setAutoDisconnectWarning] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [partnerHasVideo, setPartnerHasVideo] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);

  const localVideoRef = useRef(null);
  const partnerVideoRef = useRef(null);
  const streamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const webrtcStartedRef = useRef(false);
  const startWebRTCRef = useRef(null);
  const createPCRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const iceServersCacheRef = useRef(null);

  // Lấy danh sách ICE Servers từ Backend hoặc OpenRelay
  const getIceServers = useCallback(async () => {
    if (iceServersCacheRef.current) return iceServersCacheRef.current;
    
    let turnServers = [];
    try {
      // 1. Thử gọi lên Backend của bạn (Nơi chứa Key cá nhân nếu bạn có)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/turn-credentials`);
      if (response.ok) {
        turnServers = await response.json();
      }
    } catch (err) {
      console.log('[WebRTC] Backend chưa cấu hình TURN, chuyển sang OpenRelay Public API...');
    }

    // 2. Nếu Backend trả về mảng rỗng (chưa có key cá nhân) hoặc lỗi, dùng OpenRelay công khai
    if (turnServers.length === 0 || (turnServers.length > 0 && turnServers[0].username === 'openrelayproject')) {
      try {
        const publicRes = await fetch("https://openrelay.metered.ca/api/v1/turn/credentials?apiKey=openrelayproject");
        turnServers = await publicRes.json();
      } catch (err) {
        console.error('[WebRTC] Lỗi lấy OpenRelay:', err);
      }
    }

    // Gộp STUN của Google và TURN server
    iceServersCacheRef.current = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      ...turnServers
    ];
    
    return iceServersCacheRef.current;
  }, []);

  // Tạo PeerConnection — gọi nhiều lần an toàn (idempotent)
  const createPeerConnection = useCallback(async () => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    console.log('[WebRTC] Creating PeerConnection...');
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    peerConnectionRef.current = pc;

    // Thêm track từ local stream (nếu đã có)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current);
      });
      console.log('[WebRTC] Added local tracks:', streamRef.current.getTracks().length);
    }

    // Nhận track từ partner
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      if (partnerVideoRef.current && event.streams[0]) {
        partnerVideoRef.current.srcObject = event.streams[0];
        setPartnerHasVideo(true);
      }
    };

    // Gửi ICE candidates qua Socket
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket.emit('webrtc_ice_candidate', { roomId, candidate: event.candidate });
      }
    };

    // Theo dõi trạng thái kết nối ICE
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setPartnerHasVideo(true);
      } else if (pc.iceConnectionState === 'disconnected') {
        setPartnerHasVideo(false);
      } else if (pc.iceConnectionState === 'failed') {
        setPartnerHasVideo(false);
        console.log('[WebRTC] ICE failed, attempting ICE restart...');
        pc.createOffer({ iceRestart: true })
          .then(offer => pc.setLocalDescription(offer))
          .then(() => {
            const socket = getSocket();
            socket.emit('webrtc_offer', { roomId, offer: pc.localDescription });
          })
          .catch(err => console.error('[WebRTC] ICE restart failed:', err));
      }
    };

    return pc;
  }, [roomId]);

  // Bắt đầu handshake WebRTC — chỉ bên "caller" tạo offer
  const startWebRTC = useCallback(async () => {
    if (webrtcStartedRef.current) return;
    webrtcStartedRef.current = true;

    // Luôn tạo PeerConnection để có thể nhận media từ partner
    // dù chưa có local stream (fix: user không có cam/mic vẫn nghe được)
    const pc = await createPeerConnection();

    // Chỉ 1 bên tạo Offer (bên có id nhỏ hơn)
    if (partner && String(user.id) < String(partner.id)) {
      try {
        // Nếu chưa có local stream, chờ một lát rồi retry
        if (!streamRef.current) {
          console.log('[WebRTC] No local stream yet, waiting 3s for media...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        console.log('[WebRTC] I am the caller, creating offer...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const socket = getSocket();
        socket.emit('webrtc_offer', { roomId, offer: pc.localDescription });
        console.log('[WebRTC] Offer sent!');
      } catch (err) {
        console.error('[WebRTC] Failed to create offer:', err);
        webrtcStartedRef.current = false; // cho phép thử lại
      }
    } else {
      console.log('[WebRTC] I am the callee, waiting for offer...');
    }
  }, [createPeerConnection, partner, roomId, user.id]);

  // Cập nhật refs để socket handlers dùng (tránh stale closures)
  useEffect(() => { startWebRTCRef.current = startWebRTC; }, [startWebRTC]);
  useEffect(() => { createPCRef.current = createPeerConnection; }, [createPeerConnection]);

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const countdownRef = useRef(null);

  // SVG Icons
  const MicIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>;
  const MicOffIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/></svg>;
  const VideoIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>;
  const VideoOffIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z"/><line x1="2" x2="22" y1="2" y2="22"/></svg>;
  const PhoneOffIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" x2="2" y1="2" y2="22"/></svg>;
  const MessageIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>;
  const WarningIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>;

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

  // Xin quyền media — thử từng thiết bị nếu không có đủ
  const requestMedia = useCallback(async () => {
    const applyStream = (stream) => {
      // Bắt đầu với trạng thái tắt
      stream.getAudioTracks().forEach(track => track.enabled = false);
      stream.getVideoTracks().forEach(track => track.enabled = false);
      
      streamRef.current = stream;
      setPermissionDenied(false);
      setShowPermissionPopup(false);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      console.log('[Media] Got stream:', stream.getTracks().map(t => t.kind).join(', '));

      // FIX: Nếu PC đã tạo nhưng chưa có track → thêm track ngay
      if (peerConnectionRef.current && peerConnectionRef.current.getSenders().length === 0) {
        stream.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, stream);
        });
        console.log('[WebRTC] Late-added tracks to existing PeerConnection');
      }
    };

    // Thử lần lượt: video+audio → audio only → video only
    const attempts = [
      { video: true, audio: true, label: 'camera & mic' },
      { video: false, audio: true, label: 'mic only' },
      { video: true, audio: false, label: 'camera only' },
    ];

    for (const attempt of attempts) {
      try {
        console.log(`[Media] Trying ${attempt.label}...`);
        const stream = await navigator.mediaDevices.getUserMedia(attempt);
        applyStream(stream);

        // Thông báo nếu thiếu thiết bị
        if (!attempt.video) {
          addSystemMessage('Không tìm thấy Camera. Bạn chỉ có thể dùng Mic.');
        } else if (!attempt.audio) {
          addSystemMessage('Không tìm thấy Micro. Bạn chỉ có thể dùng Camera.');
        }
        return; // thành công → dừng
      } catch (err) {
        const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
        const isDeviceBusy = err.name === 'NotReadableError';
        const isSecurityBlock = err.name === 'SecurityError';
        if (isDenied || isSecurityBlock) {
          console.error('[Media] Quyền bị từ chối:', err);
          setPermissionDenied(true);
          setShowPermissionPopup(true);
          addSystemMessage('Camera/Mic bị chặn. Hãy cấp quyền trong trình duyệt.');
          return;
        }
        if (isDeviceBusy) {
          console.warn(`[Media] ${attempt.label} bị thiết bị khác chiếm:`, err.message);
          addSystemMessage('Camera/Mic đang được sử dụng bởi ứng dụng khác (Zoom, Meet...). Hãy đóng ứng dụng đó lại.');
          return;
        }
        console.warn(`[Media] ${attempt.label} failed:`, err.name, err.message);
      }
    }

    // Không có thiết bị nào → vẫn cho vào phòng chat text
    console.warn('[Media] Không tìm thấy thiết bị nào. Chỉ dùng chat text.');
    addSystemMessage('Không tìm thấy Camera và Micro. Bạn vẫn có thể chat bằng tin nhắn.');
  }, [addSystemMessage]);

  // ========================
  // Effect 1: Xin quyền media lần đầu (không WebRTC!)
  // ========================
  useEffect(() => {
    requestMedia();

    return () => {
      // Cleanup: dừng stream và đóng PeerConnection
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      webrtcStartedRef.current = false;
      iceCandidateQueueRef.current = [];
    };
  }, [requestMedia]);

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

      // Reset WebRTC và khởi động lại để tạo PeerConnection mới
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      webrtcStartedRef.current = false;
      iceCandidateQueueRef.current = [];
      setTimeout(() => {
        startWebRTCRef.current?.();
      }, 1000);
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

      // Sau khi join room thành công → chờ 2s rồi bắt đầu WebRTC
      // Delay đảm bảo cả 2 bên đã join room và setup listeners
      console.log('[WebRTC] Room joined, will start WebRTC in 2s...');
      setTimeout(() => {
        startWebRTCRef.current?.();
      }, 2000);
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

    // === WEBRTC SIGNALING ===
    socket.on('webrtc_offer', async ({ offer }) => {
      try {
        console.log('[WebRTC] Received offer, creating answer...');
        let pc = peerConnectionRef.current;
        if (!pc && createPCRef.current) {
          pc = await createPCRef.current();
        }
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', { roomId, answer: pc.localDescription });
        console.log('[WebRTC] Answer sent!');

        // Process queued ICE candidates
        while (iceCandidateQueueRef.current.length > 0) {
          const candidate = iceCandidateQueueRef.current.shift();
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('[WebRTC] Error adding queued ICE candidate', e);
          }
        }
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    });

    socket.on('webrtc_answer', async ({ answer }) => {
      try {
        console.log('[WebRTC] Received answer');
        if (peerConnectionRef.current) {
          const pc = peerConnectionRef.current;
          await pc.setRemoteDescription(new RTCSessionDescription(answer));

          // Process queued ICE candidates
          while (iceCandidateQueueRef.current.length > 0) {
            const candidate = iceCandidateQueueRef.current.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error('[WebRTC] Error adding queued ICE candidate', e);
            }
          }
        }
      } catch (err) {
        console.error('[WebRTC] Error handling answer:', err);
      }
    });

    socket.on('webrtc_ice_candidate', async ({ candidate }) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          console.log('[WebRTC] Queuing ICE candidate (no remoteDescription yet)');
          iceCandidateQueueRef.current.push(candidate);
        }
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
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
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');

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

      {/* Permission Denied Popup — Google Meet style */}
      {showPermissionPopup && (
        <div className="permission-overlay">
          <div className="permission-popup glass-card">
            <div className="permission-popup-icon">⚠️</div>
            <h3>Camera và Micro bị chặn</h3>
            <p className="permission-popup-desc">
              StudyRandom cần quyền truy cập Camera và Micro để bạn có thể gọi video với bạn học.
            </p>
            <div className="permission-steps">
              <div className="permission-step">
                <span className="step-num">1</span>
                <span>Nhấn vào biểu tượng <strong>🔒 ổ khóa</strong> hoặc <strong>📷 camera</strong> trên thanh địa chỉ trình duyệt</span>
              </div>
              <div className="permission-step">
                <span className="step-num">2</span>
                <span>Chọn <strong>"Cho phép"</strong> (Allow) cho Camera và Micro</span>
              </div>
              <div className="permission-step">
                <span className="step-num">3</span>
                <span>Nhấn nút bên dưới để thử lại</span>
              </div>
            </div>
            <div className="permission-actions">
              <button className="btn btn-primary" onClick={requestMedia}>
                🔄 Thử lại cấp quyền
              </button>
              <button className="btn btn-secondary" onClick={() => setShowPermissionPopup(false)}>
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Body */}
      <div className="room-body">
        
        {/* Main Video Area */}
        <div className={`main-video-area ${showChat ? 'with-chat' : 'full-width'}`}>
          <div className="video-grid">
            
            {/* Partner Video Card */}
            <div className="video-card partner-video">
              {/* Thẻ video ẩn đi nếu chưa có luồng, nhưng luôn render để gắn ref */}
              <video 
                ref={partnerVideoRef} 
                autoPlay 
                playsInline 
                className={`video-element ${!partnerHasVideo ? 'hidden' : ''}`}
              />

              {!partnerHasVideo && (
                partnerLeft ? (
                  <div className="video-offline">
                    <img
                      src={partner?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.username}`}
                      alt="partner"
                      className="video-avatar-fallback offline"
                    />
                    <span className="video-status-text">Đã rời phòng</span>
                  </div>
                ) : partner ? (
                  <>
                    <div className="video-simulated-feed">
                      <img
                        src={partner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.username}`}
                        alt={partner.username}
                        className="video-avatar-fallback"
                      />
                      <div className="pulse-ring"></div>
                    </div>
                    <div className="video-label">{partner.username}</div>
                  </>
                ) : (
                  <div className="video-offline">
                    <span className="video-status-text">Đang kết nối...</span>
                  </div>
                )
              )}
            </div>

            {/* Self Video Card */}
            <div className="video-card self-video">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`video-element ${isVideoOff ? 'hidden' : ''}`}
              />
              {isVideoOff && (
                <div className="video-offline">
                  <img
                    src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                    alt="You"
                    className="video-avatar-fallback"
                  />
                  <span className="video-status-text">Camera tắt</span>
                </div>
              )}
              <div className="video-label">Bạn {isMuted && <span className="muted-icon">🔇</span>}</div>
            </div>

          </div>

          {/* Control Bar */}
          <div className="control-bar">
            <button 
              className={`control-btn ${permissionDenied ? 'warning' : isMuted ? 'danger' : 'active'}`}
              onClick={() => {
                if (permissionDenied) {
                  setShowPermissionPopup(true);
                  return;
                }
                if (streamRef.current) {
                  streamRef.current.getAudioTracks().forEach(track => track.enabled = isMuted);
                }
                setIsMuted(!isMuted);
              }}
              title={permissionDenied ? "Micro bị chặn — nhấn để cấp quyền" : isMuted ? "Bật Mic" : "Tắt Mic"}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
              {permissionDenied && <span className="control-badge"><WarningIcon /></span>}
            </button>
            <button 
              className={`control-btn ${permissionDenied ? 'warning' : isVideoOff ? 'danger' : 'active'}`}
              onClick={() => {
                if (permissionDenied) {
                  setShowPermissionPopup(true);
                  return;
                }
                if (streamRef.current) {
                  streamRef.current.getVideoTracks().forEach(track => track.enabled = isVideoOff);
                }
                setIsVideoOff(!isVideoOff);
              }}
              title={permissionDenied ? "Camera bị chặn — nhấn để cấp quyền" : isVideoOff ? "Bật Camera" : "Tắt Camera"}
            >
              {isVideoOff ? <VideoOffIcon /> : <VideoIcon />}
              {permissionDenied && <span className="control-badge"><WarningIcon /></span>}
            </button>
            <button 
              className="control-btn end-call-btn"
              onClick={handleLeaveRoom}
              title="Rời phòng"
            >
              <PhoneOffIcon />
            </button>
            <button 
              className={`control-btn ${showChat ? 'active' : ''}`}
              onClick={() => setShowChat(!showChat)}
              title="Mở Chat"
            >
              <MessageIcon />
            </button>
          </div>
        </div>

        {/* Chat Area (Sidebar) */}
        {showChat && (
          <div className="chat-sidebar glass-card">
            <div className="chat-header">
              <h3>💬 Tin nhắn trong cuộc gọi</h3>
              <button className="close-chat-btn" onClick={() => setShowChat(false)}>✕</button>
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
        )}
      </div>
    </div>
  );
}
