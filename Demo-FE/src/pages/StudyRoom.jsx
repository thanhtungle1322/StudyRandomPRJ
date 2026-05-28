import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket, connectSocket, onSocketEvent } from '../services/socket';
import api from '../services/api';
import { FiBook, FiRefreshCw, FiAlertTriangle, FiClock, FiVideo, FiVideoOff, FiMessageSquare, FiSmile, FiInfo, FiSend, FiArrowLeft, FiUserPlus, FiUserCheck, FiLoader, FiCheck } from 'react-icons/fi';
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

  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [partnerHasVideo, setPartnerHasVideo] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);

  // Pomodoro
  const [pomodoroMode, setPomodoroMode] = useState('focus');
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);

  // Review & Stats
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [sessionStartTime] = useState(Date.now());

  // Trạng thái kết bạn với partner
  const [friendStatus, setFriendStatus] = useState('none');
  const [friendshipId, setFriendshipId] = useState(null);
  const [friendLoading, setFriendLoading] = useState(false);

  const localVideoRef = useRef(null);
  const partnerVideoRef = useRef(null);
  const streamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const webrtcStartedRef = useRef(false);
  const startWebRTCRef = useRef(null);
  const createPCRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const iceServersCacheRef = useRef(null);

  // Lấy danh sách ICE Servers động từ Backend (Kiến trúc Flex/Enterprise)
  const getIceServers = useCallback(async () => {
    if (iceServersCacheRef.current) return iceServersCacheRef.current;
    
    let turnServers = [];
    
    try {
      console.log('[WebRTC] Đang xin cấp TURN Server Token từ Backend...');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/turn-credentials`);
      
      if (response.ok) {
        turnServers = await response.json();
        if (turnServers.length > 0) {
          console.log('[WebRTC] Đã được Backend cấp TURN Token thành công (Thời hạn 1h) 😎');
        } else {
          console.warn('[WebRTC] Backend trả về rỗng. Chưa cấu hình METERED_API_KEY ở Backend?');
        }
      }
    } catch (error) {
      console.error('[WebRTC] Không thể kết nối tới Backend để lấy Token:', error);
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

    const myId = String(user?.id || user?.userId || user?._id);
    const partnerId = String(partner?.id || partner?.userId || partner?._id);

    // Chỉ 1 bên tạo Offer (bên có id nhỏ hơn)
    if (partner && myId < partnerId) {
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
  const MicIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>;
  const MicOffIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" x2="22" y1="2" y2="22" /><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" /><path d="M5 10v2a7 7 0 0 0 12 5" /><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12" /><line x1="12" x2="12" y1="19" y2="22" /></svg>;
  const VideoIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg>;
  const VideoOffIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.66 6H14a2 2 0 0 1 2 2v2.34l1 1L22 8v8" /><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2l10 10Z" /><line x1="2" x2="22" y1="2" y2="22" /></svg>;
  const PhoneOffIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /><line x1="22" x2="2" y1="2" y2="22" /></svg>;
  const MessageIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" /></svg>;
  const WarningIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>;

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

  // Pomodoro Timer Effect
  useEffect(() => {
    let interval = null;
    if (isPomodoroRunning && pomodoroTime > 0) {
      interval = setInterval(() => {
        setPomodoroTime((prev) => prev - 1);
      }, 1000);
    } else if (pomodoroTime === 0) {
      setIsPomodoroRunning(false);
      // Switch mode
      if (pomodoroMode === 'focus') {
        addSystemMessage('Hết thời gian tập trung! Nghỉ giải lao 5 phút nào.');
        setPomodoroMode('break');
        setPomodoroTime(5 * 60);
      } else {
        addSystemMessage('Hết giờ giải lao! Quay lại tập trung 25 phút nào.');
        setPomodoroMode('focus');
        setPomodoroTime(25 * 60);
      }
    }
    return () => clearInterval(interval);
  }, [isPomodoroRunning, pomodoroTime, pomodoroMode, addSystemMessage]);

  const togglePomodoro = () => {
    setIsPomodoroRunning(!isPomodoroRunning);
  };
  
  const resetPomodoro = () => {
    setIsPomodoroRunning(false);
    setPomodoroMode('focus');
    setPomodoroTime(25 * 60);
  };

  const formatPomodoro = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

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

  // Kiểm tra trạng thái kết bạn với partner
  useEffect(() => {
    if (!partner) return;
    const partnerId = partner.userId || partner.id || partner._id;
    if (!partnerId) return;
    api.get(`/friends/status/${partnerId}`)
      .then(res => {
        const status = res.data.status || 'none';
        setFriendStatus(status);
        // Lưu friendshipId từ API response
        if (res.data.friendshipId) {
          setFriendshipId(res.data.friendshipId);
        }
        // Nếu là pending_received mà chưa có friendshipId, fetch từ pending list
        if (status === 'pending_received' && !res.data.friendshipId) {
          api.get('/friends/pending').then(pendingRes => {
            if (pendingRes.data.success) {
              const req = pendingRes.data.requests.find(r => r.requester._id === partnerId);
              if (req) setFriendshipId(req.friendshipId);
            }
          }).catch(() => {});
        }
      })
      .catch(() => setFriendStatus('none'));
  }, [partner]);

  const handleAddFriend = async () => {
    if (friendLoading) return;

    // Nếu đối phương đã gửi lời mời → tự động accept
    if (friendStatus === 'pending_received') {
      setFriendLoading(true);
      try {
        let fid = friendshipId;
        // Fallback: nếu chưa có friendshipId, fetch từ pending list
        if (!fid) {
          const partnerId = partner?.userId || partner?.id || partner?._id;
          const pendingRes = await api.get('/friends/pending');
          if (pendingRes.data.success) {
            const req = pendingRes.data.requests.find(r => r.requester._id === partnerId);
            if (req) fid = req.friendshipId;
          }
        }
        if (!fid) {
          console.error('Cannot find friendshipId to accept');
          return;
        }
        const socket = getSocket();
        socket.emit('friend:respond', { friendshipId: fid, action: 'accept' });
        setFriendStatus('accepted');
        setFriendshipId(fid);
        addSystemMessage('Bạn và đối phương đã trở thành bạn bè! 🎉');
      } catch (err) {
        console.error('Failed to accept friend request:', err);
      } finally {
        setFriendLoading(false);
      }
      return;
    }

    // Nếu chưa có quan hệ → gửi lời mời mới
    if (friendStatus !== 'none') return;
    const partnerId = partner?.userId || partner?.id || partner?._id;
    if (!partnerId) return;
    setFriendLoading(true);
    try {
      const socket = getSocket();
      socket.emit('friend:request', { recipientId: partnerId });
      setFriendStatus('pending_sent');
    } catch (err) {
      console.error('Failed to send friend request:', err);
    } finally {
      setFriendLoading(false);
    }
  };

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

      // Extract partner info from room data (fallback if location.state is missing)
      if (!partner && room.users) {
        const partnerData = room.users.find(u => u.user.userId !== user?.id);
        if (partnerData) {
          setPartner(partnerData.user);
        }
      }

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

    // === FRIEND STATUS UPDATES ===
    socket.on('friend:request_accepted', (data) => {
      const partnerId = partner?.userId || partner?.id || partner?._id;
      if (data.friend?._id === partnerId) {
        setFriendStatus('accepted');
        addSystemMessage('Bạn và đối phương đã trở thành bạn bè! 🎉');
      }
    });

    socket.on('friend:request_received', (data) => {
      const partnerId = partner?.userId || partner?.id || partner?._id;
      if (data.requester?._id === partnerId) {
        setFriendStatus('pending_received');
        setFriendshipId(data.friendshipId);
        addSystemMessage('Đối phương đã gửi lời mời kết bạn cho bạn!');
      }
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
      socket.off('friend:request_accepted');
      socket.off('friend:request_received');

      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [roomId, navigate, user, addSystemMessage, partner]);

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

  const handleLeaveRoomClick = () => {
    if (partner && !partnerLeft) {
      // Show review modal if partner is still here or we just studied with them
      setShowReviewModal(true);
    } else {
      handleFinalLeave();
    }
  };

  const handleFinalLeave = async () => {
    try {
      // Tính toán thời gian học
      const studyMinutes = Math.floor((Date.now() - sessionStartTime) / 60000);
      if (studyMinutes > 0 && user) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        await fetch(`${apiUrl}/users/study-time`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id || user.dbId, minutes: studyMinutes })
        });
      }
    } catch (e) {
      console.error('Failed to submit study time', e);
    }

    const socket = getSocket();
    socket.emit('leave_room', { roomId });
    navigate('/lobby');
  };

  const submitReview = async () => {
    try {
      if (partner) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        await fetch(`${apiUrl}/users/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            reviewerId: user.id || user.dbId,
            revieweeId: partner.id || partner._id,
            sessionId: roomId, // Using roomId as sessionId for MVP simplicity
            rating: reviewRating,
            comment: reviewComment
          })
        });
      }
    } catch (e) {
      console.error('Failed to submit review', e);
    }
    handleFinalLeave();
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
          <div className="room-info">
            <h2>Phòng Học</h2>
            <span className="room-subject-badge">
              <FiBook style={{ color: '#845ef7' }} /> {subjectNames[subject] || subject}
            </span>
          </div>
          {/* Add Friend Button */}
          {partner && friendStatus !== 'accepted' && friendStatus !== 'self' && (
            <button
              className={`room-add-friend-btn ${friendStatus === 'pending_sent' ? 'pending' : ''} ${friendStatus === 'pending_received' ? 'received' : ''}`}
              onClick={handleAddFriend}
              disabled={friendLoading || friendStatus === 'pending_sent'}
              title={
                friendStatus === 'pending_sent' ? 'Đã gửi lời mời kết bạn' :
                friendStatus === 'pending_received' ? 'Nhấn để chấp nhận lời mời kết bạn' :
                'Gửi lời mời kết bạn'
              }
            >
              {friendLoading ? (
                <FiLoader className="spin-icon" />
              ) : friendStatus === 'pending_sent' ? (
                <FiUserCheck />
              ) : friendStatus === 'pending_received' ? (
                <FiCheck />
              ) : (
                <FiUserPlus />
              )}
              <span>
                {friendStatus === 'pending_sent' ? 'Đã gửi lời mời' :
                 friendStatus === 'pending_received' ? 'Chấp nhận kết bạn' :
                 'Kết bạn'}
              </span>
            </button>
          )}
          {partner && friendStatus === 'accepted' && (
            <span className="room-friend-badge">
              <FiUserCheck /> Bạn bè
            </span>
          )}
        </div>
        <div className="room-header-right">
          {/* Pomodoro Timer UI */}
          <div className={`pomodoro-container ${pomodoroMode === 'break' ? 'break-mode' : ''}`}>
            <span className="pomodoro-icon">
              {pomodoroMode === 'focus' ? '🍅' : '☕'}
            </span>
            <span className="pomodoro-time">
              {formatPomodoro(pomodoroTime)}
            </span>
            <button className="pomodoro-btn" onClick={togglePomodoro}>
              {isPomodoroRunning ? '⏸' : '▶'}
            </button>
            <button className="pomodoro-btn" onClick={resetPomodoro}>
              ↺
            </button>
          </div>

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
              onClick={handleLeaveRoomClick}
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
                  className={`message ${msg.isSystem
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

      {/* Review Modal */}
      {showReviewModal && (
        <div className="permission-overlay animate-fade-in">
          <div className="permission-popup glass-card review-modal">
            <h2 style={{ marginBottom: '16px' }}>Đánh giá buổi học</h2>
            <p style={{ marginBottom: '24px', opacity: 0.8 }}>
              Hãy đánh giá thái độ học tập của <strong>{partner?.username}</strong> nhé!
            </p>
            
            <div className="rating-stars" style={{ display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '32px', marginBottom: '20px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span 
                  key={star} 
                  style={{ cursor: 'pointer', color: star <= reviewRating ? '#fadb14' : '#e8e8e8' }}
                  onClick={() => setReviewRating(star)}
                >
                  ★
                </span>
              ))}
            </div>

            <textarea 
              className="input-field" 
              placeholder="Nhận xét (không bắt buộc)..." 
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
              style={{ width: '100%', marginBottom: '20px', resize: 'none' }}
            />

            <div className="permission-actions">
              <button className="btn btn-primary" onClick={submitReview}>
                Gửi đánh giá & Rời phòng
              </button>
              <button className="btn btn-secondary" onClick={handleFinalLeave}>
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
