import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { getSocket, connectSocket, onSocketEvent } from '../services/socket';
import api from '../services/api';
import { getSubjectName } from '../data/subjects';
import { FiBook, FiRefreshCw, FiAlertTriangle, FiClock, FiVideo, FiVideoOff, FiMessageSquare, FiSmile, FiInfo, FiSend, FiArrowLeft, FiUserPlus, FiUserCheck, FiLoader, FiCheck, FiTv, FiPlay, FiPause, FiRotateCcw, FiCoffee, FiTarget, FiEdit3 } from 'react-icons/fi';
import { FaCircle } from 'react-icons/fa';
import WhiteboardPanel from '../components/WhiteboardPanel';
import './StudyRoom.css';

export default function StudyRoom({ propRoomId }) {
  const { roomId: paramRoomId } = useParams();
  const roomId = propRoomId || paramRoomId;
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [partner, setPartner] = useState(location.state?.partner || null);
  const [subject, setSubject] = useState(location.state?.subject || '');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [partnerTempAway, setPartnerTempAway] = useState(false);
  const [partnerCameraOff, setPartnerCameraOff] = useState(true);
  const [connected, setConnected] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [autoDisconnectWarning, setAutoDisconnectWarning] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [showChat, setShowChat] = useState(() => window.innerWidth > 900);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [whiteboardHasBeenOpened, setWhiteboardHasBeenOpened] = useState(false);
  const [partnerHasVideo, setPartnerHasVideo] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);

  // Pomodoro
  const [pomodoroMode, setPomodoroMode] = useState('focus');
  const [customFocusTime, setCustomFocusTime] = useState(25);
  const [customBreakTime, setCustomBreakTime] = useState(5);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const audioContextRef = useRef(null);
  const alarmAudioRef = useRef(null);
  const alarmTimeoutRef = useRef(null);

  // Review & Stats
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

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

  // Profile Popup State
  const [profileUserId, setProfileUserId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  // Form fields for editing
  const [editNickname, setEditNickname] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editInterests, setEditInterests] = useState('');
  const [editThemeColor, setEditThemeColor] = useState('#7c3aed');
  const [editThemeGradient, setEditThemeGradient] = useState('linear-gradient(135deg, #7c3aed, #4f46e5)');
  const [editBanner, setEditBanner] = useState('');

  // Document Picture-in-Picture State & Ref
  const [isDocumentPiPActive, setIsDocumentPiPActive] = useState(false);
  const pipWindowRef = useRef(null);

  const handleOpenProfile = async (targetUserId) => {
    if (!targetUserId) return;
    setProfileUserId(targetUserId);
    setProfileLoading(true);
    setIsEditingProfile(false);
    try {
      console.log('[Profile] Fetching profile for user:', targetUserId);
      const response = await api.get(`/profile/${targetUserId}`);
      if (response.data?.success) {
        const data = response.data.data;
        setProfileData(data);
        // Pre-fill edit form
        setEditNickname(data.user.nickname || '');
        setEditBio(data.user.bio || '');
        setEditInterests(data.user.interests?.join(', ') || '');
        setEditThemeColor(data.user.themeColor || '#7c3aed');
        setEditThemeGradient(data.user.themeGradient || 'linear-gradient(135deg, #7c3aed, #4f46e5)');
        setEditBanner(data.user.banner || '');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const parsedInterests = editInterests
        .split(',')
        .map((i) => i.trim())
        .filter(Boolean);
        
      const response = await api.put('/profile', {
        nickname: editNickname,
        bio: editBio,
        interests: parsedInterests,
        themeColor: editThemeColor,
        themeGradient: editThemeGradient,
        banner: editBanner,
      });

      if (response.data?.success) {
        setProfileData((prev) => ({
          ...prev,
          user: response.data.user,
        }));
        setIsEditingProfile(false);
        addSystemMessage('Đã cập nhật trang cá nhân thành công! ✨');
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert(err.response?.data?.message || 'Lỗi khi cập nhật profile');
    }
  };

  // Lấy danh sách ICE Servers động từ Backend (Kiến trúc Flex/Enterprise)
  const getIceServers = useCallback(async () => {
    if (iceServersCacheRef.current) return iceServersCacheRef.current;
    
    let turnServers = [];
    
    try {
      console.log('[WebRTC] Đang xin cấp TURN Server Token từ Backend...');
      const response = await api.get('/turn-credentials');
      turnServers = Array.isArray(response.data) ? response.data : [];
      if (turnServers.length > 0) {
        console.log('[WebRTC] Đã được Backend cấp TURN Token thành công.');
      } else {
        console.warn('[WebRTC] Backend chưa cung cấp TURN server; tiếp tục với STUN.');
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
  }, [getIceServers, roomId]);

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
  }, [createPeerConnection, partner, roomId, user]);

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

  // Khởi tạo HTML5 Audio cho Pomodoro
  useEffect(() => {
    alarmAudioRef.current = new Audio('/alarm.wav');
    return () => {
      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
      }
    };
  }, []);

  // Pomodoro Timer Effect
  useEffect(() => {
    let interval = null;
    if (isPomodoroRunning && pomodoroTime > 0) {
      interval = setInterval(() => {
        setPomodoroTime((prev) => prev - 1);
      }, 1000);
    } else if (pomodoroTime === 0) {
      setIsPomodoroRunning(false);
      setIsAlarmActive(true);
      playAlarm();

      alarmTimeoutRef.current = setTimeout(() => {
        setIsAlarmActive(false);
      }, 4000);

      const nextMode = pomodoroMode === 'focus' ? 'break' : 'focus';
      const nextTime = ((nextMode === 'focus' ? customFocusTime : customBreakTime) || (nextMode === 'focus' ? 25 : 5)) * 60;

      setPomodoroMode(nextMode);
      setPomodoroTime(nextTime);

      addSystemMessage(nextMode === 'break'
        ? `Hết thời gian tập trung! Nghỉ giải lao ${customBreakTime} phút nào.`
        : `Hết giờ giải lao! Quay lại tập trung ${customFocusTime} phút nào.`
      );
    }
    return () => {
      if (interval) clearInterval(interval);
      if (alarmTimeoutRef.current) {
        clearTimeout(alarmTimeoutRef.current);
        alarmTimeoutRef.current = null;
      }
    };
  }, [isPomodoroRunning, pomodoroTime, pomodoroMode, addSystemMessage, customFocusTime, customBreakTime]);

  const playAlarm = async () => {
    let playedSuccessfully = false;

    if (alarmAudioRef.current) {
      try {
        alarmAudioRef.current.currentTime = 0;
        await alarmAudioRef.current.play();
        playedSuccessfully = true;
      } catch (e) {
        console.warn('HTML5 Audio playback failed, falling back to Web Audio API:', e);
      }
    }

    if (!playedSuccessfully) {
      try {
        let ctx = audioContextRef.current;
        if (!ctx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          ctx = new AudioContextClass();
          audioContextRef.current = ctx;
        }
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const now = ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99];

        freqs.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.value = freq;

          const startTime = now + index * 0.08;
          const duration = 1.5;

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
          gain.gain.linearRampToValueAtTime(0, startTime + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + duration);
        });
      } catch (e) {
        console.warn('Failed to play AudioContext alarm fallback:', e);
      }
    }
  };

  const togglePomodoro = () => {
    setIsPomodoroRunning(!isPomodoroRunning);

    if (alarmAudioRef.current) {
      alarmAudioRef.current.play()
        .then(() => {
          alarmAudioRef.current.pause();
          alarmAudioRef.current.currentTime = 0;
        })
        .catch(() => {});
    }

    if (!audioContextRef.current) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      } catch (e) {
        console.warn('Web Audio API is not supported:', e);
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  };

  const resetPomodoro = () => {
    setIsPomodoroRunning(false);
    setIsAlarmActive(false);
    setPomodoroMode('focus');
    setPomodoroTime((customFocusTime || 25) * 60);

    if (alarmAudioRef.current) {
      alarmAudioRef.current.play()
        .then(() => {
          alarmAudioRef.current.pause();
          alarmAudioRef.current.currentTime = 0;
        })
        .catch(() => {});
    }

    if (!audioContextRef.current) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      } catch (e) {
        console.warn(e);
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
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

  // Lưu trạng thái phòng học đang hoạt động vào localStorage
  useEffect(() => {
    if (roomId) {
      localStorage.setItem('activeStudySession', JSON.stringify({
        roomId,
        subject: subject || location.state?.subject || '',
        partner: partner || location.state?.partner || null
      }));
      window.dispatchEvent(new Event('storage'));
    }
  }, [roomId, subject, partner, location.state]);

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

  // Kích hoạt/Tắt chế độ Picture-in-Picture (Hình trong hình)
  const handlePiP = useCallback(async () => {
    try {
      // 1. Kiểm tra và sử dụng Document Picture-in-Picture API (Google Meet Style)
      if ('documentPictureInPicture' in window) {
        if (window.documentPictureInPicture.window) {
          // Nếu đang mở -> nhấn để đóng
          window.documentPictureInPicture.window.close();
          return;
        }

        console.log('[PiP] Khởi chạy Document Picture-in-Picture...');
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 380,
          height: 280,
        });

        // Định dạng body của cửa sổ nổi để không bị lề trắng thừa
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.padding = '0';
        pipWindow.document.body.style.background = '#0c0e17';
        pipWindow.document.body.style.overflow = 'hidden';

        // Tạo container div bên trong document của PiP window làm gốc cho React Portal
        const container = pipWindow.document.createElement('div');
        container.id = 'pip-root';
        container.style.height = '100vh';
        pipWindow.document.body.appendChild(container);

        pipWindowRef.current = container; // Lưu CONTAINER ELEMENT vào ref thay vì window object!
        setIsDocumentPiPActive(true);

        // Sao chép CSS stylesheets từ trang chính vào cửa sổ nổi nổi
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = pipWindow.document.createElement('style');
            style.textContent = cssRules;
            pipWindow.document.head.appendChild(style);
          } catch {
            const link = pipWindow.document.createElement('link');
            if (styleSheet.href) {
              link.rel = 'stylesheet';
              link.href = styleSheet.href;
              pipWindow.document.head.appendChild(link);
            }
          }
        });

        // Tải Google Font Inter cho PiP Window
        const fontLink = pipWindow.document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
        pipWindow.document.head.appendChild(fontLink);

        // Lắng nghe đóng cửa sổ nổi
        pipWindow.addEventListener('unload', () => {
          setIsDocumentPiPActive(false);
          pipWindowRef.current = null;

          // Tự động quay lại giao diện phòng học trên trang chính nếu đang xem trang khác!
          const isCurrentlyAtRoom = window.location.pathname.includes('/room/');
          if (!isCurrentlyAtRoom) {
            navigate(`/room/${roomId}`);
          }
        });

        return;
      }

      // 2. Fallback: Sử dụng thẻ <video> PiP truyền thống
      if (!document.pictureInPictureEnabled) {
        alert('Trình duyệt của bạn không hỗ trợ chế độ Hình trong hình (Picture-in-Picture).');
        return;
      }
      if (partnerVideoRef.current) {
        if (partnerCameraOff) {
          alert('Chỉ có thể bật Hình trong hình khi bạn học đang bật Camera!');
          return;
        }
        if (partnerVideoRef.current.readyState < 1) {
          alert('Đang tải dữ liệu video của bạn học... Vui lòng thử lại sau 1-2 giây!');
          return;
        }
        const stream = partnerVideoRef.current.srcObject;
        const hasVideoTracks = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
        if (!hasVideoTracks) {
          alert('Chỉ có thể bật Hình trong hình khi bạn học đang bật Camera!');
          return;
        }

        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await partnerVideoRef.current.requestPictureInPicture();
        }
      } else {
        alert('Không tìm thấy luồng video của bạn học để kích hoạt Picture-in-Picture.');
      }
    } catch (err) {
      console.warn('[PiP] Lỗi kích hoạt Picture-in-Picture:', err.message);
    }
  }, [navigate, partnerCameraOff, roomId]);

  // Tự động kích hoạt Picture-in-Picture khi người dùng ẩn tab/thu nhỏ trình duyệt
  useEffect(() => {
    const handleVisibilityChange = async () => {
      try {
        if (partnerCameraOff || !partnerVideoRef.current) return;
        if (partnerVideoRef.current.readyState < 1) return; // Chờ cho metadata sẵn sàng
        
        const stream = partnerVideoRef.current.srcObject;
        const hasVideoTracks = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
        if (!hasVideoTracks) return;

        if (document.visibilityState === 'hidden') {
          // Khi rời khỏi tab → Tự động hiện PiP của đối phương nếu chưa có cửa sổ PiP nào mở
          if (isDocumentPiPActive || document.pictureInPictureElement) return;

          // Thử mở Document PiP trước (thường Chrome yêu cầu cử chỉ click trực tiếp của người dùng, nên sẽ bắt catch nếu bị chặn)
          try {
            if ('documentPictureInPicture' in window && !window.documentPictureInPicture.window) {
              await handlePiP();
              return;
            }
          } catch {
            console.warn('[Auto PiP] Không thể tự động mở Document PiP, chuyển hướng sang Video PiP...');
          }

          // Fallback sang Video PiP truyền thống (được trình duyệt cho phép tự động khi chuyển tab!)
          if (document.pictureInPictureEnabled && !document.pictureInPictureElement) {
            await partnerVideoRef.current.requestPictureInPicture();
          }
        } else {
          // Khi quay lại tab → Tự động đóng Video PiP
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          }
        }
      } catch (e) {
        console.warn('[PiP] Tự động bật/tắt PiP thất bại:', e);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [partnerCameraOff, isDocumentPiPActive, handlePiP]);

  // Lắng nghe thay đổi Route để gửi thông báo Trạng thái Tạm xa (user_temp_away) / Quay lại (user_back)
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    const isRoomActive = location.pathname.startsWith('/room/');
    if (!isRoomActive) {
      console.log('[SPA Navigation] Người dùng tạm xa phòng học...');
      socket.emit('user_temp_away', { roomId });
    } else {
      console.log('[SPA Navigation] Người dùng quay lại phòng học.');
      socket.emit('user_back', { roomId });
    }
  }, [location.pathname, roomId]);

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

  const creditStudyTime = useCallback(async () => {
    if (!user) return;
    try {
      await api.post('/users/study-time', { roomId });
    } catch (error) {
      if (error.response?.status !== 400) {
        console.error('Failed to submit study time', error);
      }
    }
  }, [roomId, user]);

  useEffect(() => {
    const socket = connectSocket();
    const ownedHandlers = [];
    const onSocket = (event, handler) => {
      socket.on(event, handler);
      ownedHandlers.push([event, handler]);
    };

    socket.emit('join_room', { roomId });
    socket.emit('user_back', { roomId });
    socket.emit('camera_status', { roomId, isVideoOff });

    onSocket('new_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    onSocket('partner_camera_status', (data) => {
      setPartnerCameraOff(data.isVideoOff);
    });

    onSocket('partner_temp_away', (data) => {
      setPartnerTempAway(true);
      addSystemMessage(data.message || 'Bạn học đang tạm thời chuyển trang...');
    });

    onSocket('partner_back', (data) => {
      setPartnerTempAway(false);
      addSystemMessage(data.message || 'Bạn học đã quay lại!');
    });

    onSocket('partner_left', (data) => {
      setPartnerLeft(true);
      addSystemMessage(data.message || 'Bạn học đã rời phòng');
    });

    onSocket('partner_reconnected', (data) => {
      setPartnerLeft(false);
      setAutoDisconnectWarning(null);
      setCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      addSystemMessage(data.message || 'Bạn học đã kết nối lại!');
    });

    onSocket('auto_disconnect_warning', (data) => {
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

    onSocket('auto_disconnect_cancelled', (data) => {
      setAutoDisconnectWarning(null);
      setCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      addSystemMessage(data.message || 'Auto-disconnect đã hủy');
    });

    onSocket('room_auto_closed', async (data) => {
      setAutoDisconnectWarning(null);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      localStorage.removeItem('activeStudySession');
      window.dispatchEvent(new Event('storage'));
      addSystemMessage(data.message || 'Phòng đã tự động đóng');
      await creditStudyTime();
      setTimeout(() => navigate('/lobby'), 2000);
    });

    onSocket('session_time_limit_reached', async (data) => {
      localStorage.removeItem('activeStudySession');
      window.dispatchEvent(new Event('storage'));
      addSystemMessage(`Phiên học đã đạt giới hạn ${data.limitMinutes} phút của gói hiện tại.`);
      await creditStudyTime();
      setTimeout(() => navigate('/lobby'), 1800);
    });

    onSocket('room_data', (room) => {
      setSubject(room.subject);
      if (room.messages) setMessages(room.messages);

      // Extract partner info from room data (fallback if location.state is missing)
      if (!partner && room.users) {
        const partnerData = room.users.find(u => u.socketId !== socket.id);
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

    onSocket('room_error', () => {
      navigate('/lobby');
    });

    onSocket('disconnect', () => {
      setConnected(false);
    });

    onSocket('connect', () => {
      setConnected(true);
      setReconnecting(false);
      socket.emit('join_room', { roomId });
    });

    // === FRIEND STATUS UPDATES ===
    onSocket('friend:request_accepted', (data) => {
      const partnerId = partner?.userId || partner?.id || partner?._id;
      if (data.friend?._id === partnerId) {
        setFriendStatus('accepted');
        addSystemMessage('Bạn và đối phương đã trở thành bạn bè! 🎉');
      }
    });

    onSocket('friend:request_received', (data) => {
      const partnerId = partner?.userId || partner?.id || partner?._id;
      if (data.requester?._id === partnerId) {
        setFriendStatus('pending_received');
        setFriendshipId(data.friendshipId);
        addSystemMessage('Đối phương đã gửi lời mời kết bạn cho bạn!');
      }
    });

    // === WEBRTC SIGNALING ===
    onSocket('webrtc_offer', async ({ offer }) => {
      try {
        console.log('[WebRTC] Received offer, creating answer...');
        let pc = peerConnectionRef.current;
        if (!pc && createPCRef.current) {
          pc = await createPCRef.current();
        }
        if (!pc) return;
        if (pc.signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' });
        } else if (pc.signalingState !== 'stable') {
          console.debug(`[WebRTC] Ignoring offer in ${pc.signalingState} state`);
          return;
        }
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

    onSocket('webrtc_answer', async ({ answer }) => {
      try {
        console.log('[WebRTC] Received answer');
        if (peerConnectionRef.current) {
          const pc = peerConnectionRef.current;
          if (pc.signalingState !== 'have-local-offer') {
            console.debug(`[WebRTC] Ignoring stale answer in ${pc.signalingState} state`);
            return;
          }
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

    onSocket('webrtc_ice_candidate', async ({ candidate }) => {
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
      ownedHandlers.forEach(([event, handler]) => socket.off(event, handler));

      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      socket.emit('user_temp_away', { roomId });
    };
  }, [roomId, navigate, user, addSystemMessage, partner, isVideoOff, creditStudyTime]);

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
    await creditStudyTime();

    const socket = getSocket();
    socket.emit('leave_room', { roomId });
    localStorage.removeItem('activeStudySession');
    window.dispatchEvent(new Event('storage'));
    navigate('/lobby');
  };

  const submitReview = async () => {
    setReviewError('');
    setReviewSubmitting(true);
    try {
      if (partner) {
        await api.post('/users/review', {
          revieweeId: partner.id || partner.userId || partner.dbId || partner._id,
          roomId,
          rating: reviewRating,
          comment: reviewComment
        });
      }
    } catch (e) {
      console.error('Failed to submit review', e);
      setReviewError(e.response?.data?.message || 'Không thể gửi đánh giá. Vui lòng thử lại hoặc chọn Bỏ qua.');
      setReviewSubmitting(false);
      return;
    }
    setReviewSubmitting(false);
    handleFinalLeave();
  };

  const getDecorClasses = (member) => {
    if (!member || !member.badges) return { wrapper: '', overlay: '' };
    if (member.badges.includes('PREMIUM_ULTIMATE')) {
      return { wrapper: 'has-decor-ultimate', overlay: 'decor-ultimate' };
    }
    if (member.badges.includes('PREMIUM_PRO')) {
      return { wrapper: 'has-decor-pro', overlay: 'decor-pro' };
    }
    if (member.badges.includes('PREMIUM_STARTER')) {
      return { wrapper: 'has-decor-starter', overlay: 'decor-starter' };
    }
    return { wrapper: '', overlay: '' };
  };

  const partnerDecors = getDecorClasses(partner);
  const selfDecors = getDecorClasses(user);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="study-room">
      <div className="room-header">
        <div className="room-header-left">
          <div className="room-info">
            <h2>Phòng Học</h2>
            <span className="room-subject-badge">
              <FiBook style={{ color: '#845ef7' }} /> {getSubjectName(subject)}{subject === '__quick__' ? ' 🎯' : ''}
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
          <div className={`pomodoro-container ${pomodoroMode === 'break' ? 'break-mode' : 'focus-mode'} ${isPomodoroRunning ? 'running' : 'paused'} ${isAlarmActive ? 'visual-alarm-flash' : ''}`}>
            <div
              className="pomodoro-progress-bar"
              style={{
                width: `${(pomodoroTime / ((pomodoroMode === 'focus' ? (customFocusTime || 25) : (customBreakTime || 5)) * 60)) * 100}%`
              }}
            />
            <span className="pomodoro-icon">
              {pomodoroMode === 'focus' ? <FiTarget className="icon-pulse" /> : <FiCoffee className="icon-swing" />}
            </span>
            <span className="pomodoro-time">
              {formatPomodoro(pomodoroTime)}
            </span>
            <button className="pomodoro-btn" onClick={togglePomodoro} title={isPomodoroRunning ? 'Tạm dừng' : 'Bắt đầu'}>
              {isPomodoroRunning ? <FiPause /> : <FiPlay />}
            </button>
            <button className="pomodoro-btn" onClick={resetPomodoro} title="Đặt lại">
              <FiRotateCcw />
            </button>

            {!isPomodoroRunning && (
              <div className="pomodoro-inline-settings">
                <span className="setting-divider">|</span>

                <div className="pomodoro-input-group" title="Thời gian tập trung">
                  <FiTarget className="setting-icon focus-icon" />
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customFocusTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setCustomFocusTime('');
                        return;
                      }
                      const parsed = parseInt(val);
                      if (!isNaN(parsed)) {
                        setCustomFocusTime(parsed);
                        if (pomodoroMode === 'focus') {
                          setPomodoroTime(parsed * 60);
                        }
                      }
                    }}
                    onBlur={() => {
                      let val = parseInt(customFocusTime);
                      if (isNaN(val) || val < 1) val = 25;
                      if (val > 60) val = 60;
                      setCustomFocusTime(val);
                      if (pomodoroMode === 'focus') {
                        setPomodoroTime(val * 60);
                      }
                    }}
                    className="pomodoro-input"
                    title="Thời gian tập trung (phút)"
                  />
                  <span className="unit-label">m</span>
                </div>

                <div className="pomodoro-input-group" title="Thời gian giải lao">
                  <FiCoffee className="setting-icon break-icon" />
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={customBreakTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setCustomBreakTime('');
                        return;
                      }
                      const parsed = parseInt(val);
                      if (!isNaN(parsed)) {
                        setCustomBreakTime(parsed);
                        if (pomodoroMode === 'break') {
                          setPomodoroTime(parsed * 60);
                        }
                      }
                    }}
                    onBlur={() => {
                      let val = parseInt(customBreakTime);
                      if (isNaN(val) || val < 1) val = 5;
                      if (val > 30) val = 30;
                      setCustomBreakTime(val);
                      if (pomodoroMode === 'break') {
                        setPomodoroTime(val * 60);
                      }
                    }}
                    className="pomodoro-input"
                    title="Thời gian giải lao (phút)"
                  />
                  <span className="unit-label">m</span>
                </div>

                <div className="pomodoro-presets">
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      setCustomFocusTime(25);
                      setCustomBreakTime(5);
                      setPomodoroTime(pomodoroMode === 'focus' ? 25 * 60 : 5 * 60);
                    }}
                    title="25 phút học / 5 phút nghỉ"
                  >
                    25/5
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      setCustomFocusTime(50);
                      setCustomBreakTime(10);
                      setPomodoroTime(pomodoroMode === 'focus' ? 50 * 60 : 10 * 60);
                    }}
                    title="50 phút học / 10 phút nghỉ"
                  >
                    50/10
                  </button>
                </div>
              </div>
            )}
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
                className="video-element"
              />

              {partnerTempAway && partner && (
                <div className="video-offline" style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(20, 20, 25, 0.92)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div 
                    className={`avatar-decor-wrapper ${partnerDecors.wrapper}`} 
                    style={{ width: '80px', height: '80px', marginBottom: '16px', cursor: 'pointer' }}
                    onClick={() => handleOpenProfile(partner?.userId || partner?.id || partner?._id)}
                    title="Xem thông tin bạn học"
                  >
                    <img
                      src={partner?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.username}`}
                      alt="partner"
                      className="video-avatar-fallback offline avatar-decor-img"
                    />
                    {partnerDecors.overlay && <div className={`avatar-decor-overlay ${partnerDecors.overlay}`}></div>}
                  </div>
                  <span className="video-status-text" style={{ fontSize: '13px', color: '#ff922b', fontWeight: '700', letterSpacing: '0.5px' }}>
                    ⚠️ Bạn học đang ở trang khác...
                  </span>
                </div>
              )}

              {partner && (
                <div 
                  className="video-hover-profile-overlay"
                  onClick={() => handleOpenProfile(partner?.userId || partner?.id || partner?._id)}
                  title="Xem hồ sơ bạn học"
                >
                  <div className={`avatar-decor-wrapper ${partnerDecors.wrapper}`} style={{ width: '80px', height: '80px' }}>
                    <img 
                      src={partner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.username}`} 
                      alt="" 
                      className="hover-overlay-avatar avatar-decor-img" 
                    />
                    {partnerDecors.overlay && <div className={`avatar-decor-overlay ${partnerDecors.overlay}`}></div>}
                  </div>
                  <span className="hover-overlay-prompt">🔍 Xem Hồ Sơ bạn học</span>
                </div>
              )}



              {(partnerCameraOff || !partnerHasVideo) && (
                partnerLeft ? (
                  <div className="video-offline">
                    <div 
                      className={`avatar-decor-wrapper ${partnerDecors.wrapper}`} 
                      style={{ width: '80px', height: '80px', marginBottom: '16px', cursor: 'pointer' }}
                      onClick={() => handleOpenProfile(partner?.userId || partner?.id || partner?._id)}
                      title="Xem thông tin bạn học"
                    >
                      <img
                        src={partner?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.username}`}
                        alt="partner"
                        className="video-avatar-fallback offline avatar-decor-img"
                      />
                      {partnerDecors.overlay && <div className={`avatar-decor-overlay ${partnerDecors.overlay}`}></div>}
                    </div>
                    <span className="video-status-text">Đã rời phòng</span>
                  </div>
                ) : partner ? (
                  <>
                    <div className="video-simulated-feed">
                      <div 
                        className={`avatar-decor-wrapper ${partnerDecors.wrapper}`} 
                        style={{ width: '100px', height: '100px', cursor: 'pointer' }}
                        onClick={() => handleOpenProfile(partner?.userId || partner?.id || partner?._id)}
                        title="Xem thông tin bạn học"
                      >
                        <img
                          src={partner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.username}`}
                          alt={partner.username}
                          className="video-avatar-fallback avatar-decor-img"
                        />
                        {partnerDecors.overlay && <div className={`avatar-decor-overlay ${partnerDecors.overlay}`}></div>}
                      </div>
                      <div className="pulse-ring"></div>
                    </div>
                    <div 
                      className="video-label" 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', cursor: 'pointer' }}
                      onClick={() => handleOpenProfile(partner?.userId || partner?.id || partner?._id)}
                      title="Xem thông tin bạn học"
                    >
                      <span>{partner.username}</span>
                      <span className="partner-reputation-stars" style={{ color: '#fadb14', fontWeight: '900', fontSize: '13px', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>
                        ⭐ {partner.reputation !== undefined ? Number(partner.reputation).toFixed(1) : '5.0'}
                      </span>
                    </div>
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
                className="video-element"
              />

              {user && (
                <div 
                  className="video-hover-profile-overlay"
                  onClick={() => handleOpenProfile(user?.id || user?.userId || user?._id)}
                  title="Chỉnh sửa hồ sơ cá nhân"
                >
                  <div className={`avatar-decor-wrapper ${selfDecors.wrapper}`} style={{ width: '80px', height: '80px' }}>
                    <img 
                      src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} 
                      alt="" 
                      className="hover-overlay-avatar avatar-decor-img" 
                    />
                    {selfDecors.overlay && <div className={`avatar-decor-overlay ${selfDecors.overlay}`}></div>}
                  </div>
                  <span className="hover-overlay-prompt">🎨 Thiết lập hồ sơ</span>
                </div>
              )}



              {isVideoOff && (
                <div className="video-offline">
                  <div 
                    className={`avatar-decor-wrapper ${selfDecors.wrapper}`} 
                    style={{ width: '80px', height: '80px', marginBottom: '16px', cursor: 'pointer' }}
                    onClick={() => handleOpenProfile(user?.id || user?.userId || user?._id)}
                    title="Chỉnh sửa thông tin cá nhân"
                  >
                    <img
                      src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                      alt="You"
                      className="video-avatar-fallback avatar-decor-img"
                    />
                    {selfDecors.overlay && <div className={`avatar-decor-overlay ${selfDecors.overlay}`}></div>}
                  </div>
                  <span className="video-status-text">Camera tắt</span>
                </div>
              )}
              <div 
                className="video-label" 
                style={{ cursor: 'pointer' }}
                onClick={() => handleOpenProfile(user?.id || user?.userId || user?._id)}
                title="Chỉnh sửa thông tin cá nhân"
              >
                Bạn {isMuted && <span className="muted-icon">🔇</span>}
              </div>
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
                const newVideoOff = !isVideoOff;
                if (streamRef.current) {
                  streamRef.current.getVideoTracks().forEach(track => track.enabled = !newVideoOff);
                }
                setIsVideoOff(newVideoOff);
                
                const socket = getSocket();
                socket.emit('camera_status', { roomId, isVideoOff: newVideoOff });
              }}
              title={permissionDenied ? "Camera bị chặn — nhấn để cấp quyền" : isVideoOff ? "Bật Camera" : "Tắt Camera"}
            >
              {isVideoOff ? <VideoOffIcon /> : <VideoIcon />}
              {permissionDenied && <span className="control-badge"><WarningIcon /></span>}
            </button>
            <button
              className="control-btn active"
              onClick={handlePiP}
              title="Xem hình trong hình (Picture-in-Picture)"
              style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'white' }}
            >
              <FiTv size={20} />
            </button>
            {/* Whiteboard Toggle Button */}
            <button
              className={`control-btn wb-toggle-btn ${showWhiteboard ? 'wb-active' : 'active'}`}
              onClick={() => {
                setShowWhiteboard((v) => !v);
                if (!whiteboardHasBeenOpened) {
                  setWhiteboardHasBeenOpened(true);
                }
              }}
              title={showWhiteboard ? 'Ẩn Bảng Trắng' : 'Mở Bảng Trắng'}
              style={!showWhiteboard ? { background: 'rgba(255, 255, 255, 0.1)', color: 'white' } : {}}
            >
              <FiEdit3 size={20} />
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
              title={showChat ? 'Đóng Chat' : 'Mở Chat'}
            >
              <MessageIcon />
            </button>
          </div>
        </div>

        {/* Whiteboard Panel — render qua Portal ra document.body, tránh ảnh hưởng layout video call */}
        {whiteboardHasBeenOpened && createPortal(
          <WhiteboardPanel
            roomId={roomId}
            isVisible={showWhiteboard}
            onClose={() => setShowWhiteboard(false)}
          />,
          document.body
        )}

        {/* Chat Area (Sidebar) */}
        {showChat && (
          <aside className="chat-sidebar glass-card" aria-label="Tin nhắn trong cuộc gọi">
            <div className="chat-header">
              <h3>💬 Tin nhắn trong cuộc gọi</h3>
              <button className="close-chat-btn" onClick={() => setShowChat(false)} aria-label="Đóng chat">✕</button>
            </div>

            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-empty">
                  <span className="chat-empty-icon">👋</span>
                  <p>Hãy gửi lời chào đến bạn học!</p>
                </div>
              )}

              {messages.map((msg) => {
                const isMine = msg.userId === user?.id
                  || msg.user?.userId === user?.id
                  || msg.user?.id === user?.id;
                return (
                <div
                  key={msg.id}
                  className={`message ${msg.isSystem
                    ? 'message-system'
                    : isMine
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
                      {!isMine && (
                        <span className="message-author">{msg.user?.username}</span>
                      )}
                      <div className="message-bubble">
                        <p>{msg.text}</p>
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                      </div>
                    </>
                  )}
                </div>
                );
              })}
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
          </aside>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="permission-overlay animate-fade-in" role="presentation">
          <div className="permission-popup glass-card review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <h2 id="review-title" style={{ marginBottom: '16px' }}>Đánh giá buổi học</h2>
            <p style={{ marginBottom: '24px', opacity: 0.8 }}>
              Hãy đánh giá thái độ học tập của <strong>{partner?.username}</strong> nhé!
            </p>
            
            <div className="rating-stars" style={{ display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '32px', marginBottom: '20px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star} 
                  className="rating-star-button"
                  style={{ cursor: 'pointer', color: star <= reviewRating ? '#fadb14' : '#e8e8e8' }}
                  onClick={() => setReviewRating(star)}
                  aria-label={`${star} sao`}
                  aria-pressed={star === reviewRating}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea 
              className="input-field" 
              placeholder="Nhận xét (không bắt buộc)..." 
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              maxLength={500}
              rows={3}
              style={{ width: '100%', marginBottom: '20px', resize: 'none' }}
            />

            {reviewError && <p className="review-error" role="alert">{reviewError}</p>}

            <div className="permission-actions">
              <button className="btn btn-primary" onClick={submitReview} disabled={reviewSubmitting}>
                {reviewSubmitting ? 'Đang gửi...' : 'Gửi đánh giá & Rời phòng'}
              </button>
              <button className="btn btn-secondary" onClick={handleFinalLeave} disabled={reviewSubmitting}>
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discord Profile Card Popup */}
      {profileUserId && (
        <div className="discord-profile-overlay" onClick={() => {
          if (!isEditingProfile) setProfileUserId(null);
        }}>
          <div className="discord-profile-card" onClick={(e) => e.stopPropagation()}>
            {profileLoading ? (
              <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <FiLoader className="spin-icon" style={{ fontSize: '32px', color: '#5865F2' }} />
                <span>Đang tải thông tin cá nhân...</span>
              </div>
            ) : profileData ? (
              <>
                {/* Banner với Gradient trang trí */}
                <div 
                  className="discord-banner" 
                  style={{ 
                    background: profileData.user.banner 
                      ? `url(${profileData.user.banner}) center/cover no-repeat` 
                      : (profileData.user.themeGradient || profileData.user.themeColor || 'linear-gradient(135deg, #7c3aed, #4f46e5)')
                  }}
                >
                  <div className="discord-avatar-container">
                    <img 
                      src={profileData.user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileData.user.displayName}`} 
                      alt="avatar" 
                      className="discord-avatar-img"
                    />
                  </div>
                </div>

                {/* Actions Row */}
                <div className="discord-profile-actions">
                  {profileData.user.id === (user?.id || user?.userId || user?._id) ? (
                    isEditingProfile ? (
                      <>
                        <button className="discord-btn discord-btn-primary" onClick={handleSaveProfile}>Lưu trang trí</button>
                        <button className="discord-btn" onClick={() => setIsEditingProfile(false)}>Hủy</button>
                      </>
                    ) : (
                      <button className="discord-btn discord-btn-primary" onClick={() => setIsEditingProfile(true)}>🎨 Trang trí Profile</button>
                    )
                  ) : (
                    <button className="discord-btn" onClick={() => setProfileUserId(null)}>Đóng</button>
                  )}
                </div>

                {/* Scrollable Body */}
                <div className="discord-profile-body">
                  {isEditingProfile ? (
                    /* Edit Form */
                    <div style={{ marginTop: '12px' }}>
                      <h3 className="discord-section-title">Chỉnh sửa trang cá nhân</h3>
                      
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Biệt danh (Nickname)</label>
                      <input 
                        type="text" 
                        className="discord-edit-input" 
                        value={editNickname} 
                        onChange={(e) => setEditNickname(e.target.value)} 
                        placeholder="VD: Tuấn Học Thuật"
                        maxLength={30}
                      />

                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Giới thiệu bản thân (Bio)</label>
                      <textarea 
                        className="discord-edit-input" 
                        style={{ height: '70px', resize: 'none' }}
                        value={editBio} 
                        onChange={(e) => setEditBio(e.target.value)} 
                        placeholder="Viết mô tả ngắn về bạn học..."
                        maxLength={200}
                      />

                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Sở thích (ngăn cách bằng dấu phẩy)</label>
                      <input 
                        type="text" 
                        className="discord-edit-input" 
                        value={editInterests} 
                        onChange={(e) => setEditInterests(e.target.value)} 
                        placeholder="VD: Toán học, NodeJS, Nhạc Lofi, Chạy bộ"
                      />

                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Ảnh bìa banner (URL)</label>
                      <input 
                        type="text" 
                        className="discord-edit-input" 
                        value={editBanner} 
                        onChange={(e) => setEditBanner(e.target.value)} 
                        placeholder="Để trống để dùng màu theme hoặc dán link ảnh vào đây"
                      />

                      <div className="discord-color-pickers">
                        <div className="discord-color-picker-group">
                          <label>Màu chủ đạo (Hex)</label>
                          <input 
                            type="color" 
                            className="discord-color-input" 
                            value={editThemeColor} 
                            onChange={(e) => {
                              setEditThemeColor(e.target.value);
                              setEditThemeGradient(e.target.value); // Sync to color if gradient is custom
                            }} 
                          />
                        </div>
                        <div className="discord-color-picker-group">
                          <label>Preset Theme</label>
                          <select 
                            className="discord-edit-input" 
                            style={{ height: '40px', marginBottom: 0 }}
                            value={editThemeGradient} 
                            onChange={(e) => {
                              setEditThemeGradient(e.target.value);
                              // Update color placeholder if solid color preset chosen
                              if (e.target.value.startsWith('#')) {
                                setEditThemeColor(e.target.value);
                              }
                            }}
                          >
                            <option value="linear-gradient(135deg, #7c3aed, #4f46e5)">Tím Hoàng Hôn</option>
                            <option value="linear-gradient(135deg, #ff6b6b, #ff8e53)">Cam Rực Rỡ</option>
                            <option value="linear-gradient(135deg, #20bf55, #01baef)">Xanh Biển Sâu</option>
                            <option value="linear-gradient(135deg, #ec008c, #fc6767)">Hồng Ngọt Ngào</option>
                            <option value="linear-gradient(135deg, #0f172a, #1e293b)">Đen Huyền Bí</option>
                            <option value="#5865F2">Discord Blurple</option>
                            <option value="#7c3aed">Tím Đậm</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <>
                      {/* Tên & Badges */}
                      <div className="discord-username-row">
                        <div className="discord-display-name">
                          <span>{profileData.user.displayName}</span>
                          {profileData.user.nickname && (
                            <span className="discord-nickname-badge">"{profileData.user.nickname}"</span>
                          )}
                        </div>
                        <div className="discord-username">@{profileData.user.email?.split('@')[0]}</div>
                        
                        {/* Render Badges */}
                        <div className="discord-badges-row">
                          {profileData.user.plan === 'premium' && (
                            <span className="discord-badge-pill" style={{ background: 'rgba(252, 196, 25, 0.15)', borderColor: '#fcc419', color: '#fcc419' }}>Premium ⭐</span>
                          )}
                          {profileData.user.badges?.map((badge, idx) => (
                            <span key={idx} className="discord-badge-pill">{badge.replace('PREMIUM_', '')}</span>
                          ))}
                          {profileData.user.totalStudyMinutes >= 600 && (
                            <span className="discord-badge-pill" style={{ background: 'rgba(81, 207, 102, 0.15)', borderColor: '#51cf66', color: '#51cf66' }}>Mộc Sách 📚</span>
                          )}
                          {profileData.user.streak >= 3 && (
                            <span className="discord-badge-pill" style={{ background: 'rgba(255, 107, 107, 0.15)', borderColor: '#ff6b6b', color: '#ff6b6b' }}>Chăm chỉ 🔥</span>
                          )}
                        </div>
                      </div>

                      <div className="discord-divider"></div>

                      {/* Bio */}
                      <div className="discord-section-title">Giới thiệu bản thân</div>
                      <div className="discord-bio" style={{ marginBottom: '16px' }}>
                        {profileData.user.bio || 'Chưa viết lời giới thiệu nào.'}
                      </div>

                      {/* Hobbies / Interests */}
                      <div className="discord-section-title">Sở thích học tập</div>
                      <div className="discord-interests-list" style={{ marginBottom: '16px' }}>
                        {profileData.user.interests?.length > 0 ? (
                          profileData.user.interests.map((interest, idx) => (
                            <span key={idx} className="discord-interest-tag">✨ {interest}</span>
                          ))
                        ) : (
                          <span style={{ fontSize: '13px', fontStyle: 'italic', opacity: 0.6 }}>Chưa chọn sở thích học tập.</span>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="discord-section-title">Thống kê học tập</div>
                      <div className="discord-stats-grid" style={{ marginBottom: '16px' }}>
                        <div className="discord-stat-card">
                          <div className="discord-stat-label">Thời gian học</div>
                          <div className="discord-stat-value">{profileData.user.totalStudyMinutes || 0} phút</div>
                        </div>
                        <div className="discord-stat-card">
                          <div className="discord-stat-label">Số buổi ghép</div>
                          <div className="discord-stat-value">{profileData.user.totalSessions || 0} buổi</div>
                        </div>
                        <div className="discord-stat-card">
                          <div className="discord-stat-label">Chuỗi streak</div>
                          <div className="discord-stat-value">{profileData.user.streak || 0} ngày</div>
                        </div>
                        <div className="discord-stat-card">
                          <div className="discord-stat-label">Uy tín học tập</div>
                          <div className="discord-stat-value" style={{ color: '#fadb14' }}>
                            ⭐ {profileData.user.reputation ? Number(profileData.user.reputation).toFixed(1) : '5.0'} ({profileData.user.ratingCount || 0})
                          </div>
                        </div>
                      </div>

                      {/* Recent Comments / Reviews */}
                      <div className="discord-section-title">Nhận xét từ bạn học</div>
                      <div className="discord-reviews-list">
                        {profileData.reviews?.length > 0 ? (
                          profileData.reviews.map((review) => (
                            <div key={review.id} className="discord-review-card">
                              <div className="discord-review-header">
                                <span className="discord-review-author">{review.reviewer.displayName}</span>
                                <span className="discord-review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                              </div>
                              <div className="discord-review-comment">
                                {review.comment || 'Không có nhận xét chi tiết.'}
                              </div>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '13px', fontStyle: 'italic', opacity: 0.6 }}>Chưa có nhận xét nào được gửi.</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center' }}>Không tìm thấy thông tin người dùng.</div>
            )}
          </div>
        </div>
      )}

      {/* Portal render Document Picture-in-Picture window content */}
      {isDocumentPiPActive && pipWindowRef.current && createPortal(
        <div style={{
          padding: '12px',
          background: '#0c0e17',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          fontFamily: "'Inter', sans-serif",
          color: '#fff',
          justifyContent: 'space-between'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#51cf66', boxShadow: '0 0 6px #51cf66' }} />
            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#845ef7' }}>
              StudyRoom PiP Mode
            </span>
          </div>

          {/* Grid Camera */}
          <div style={{ flex: 1, display: 'flex', gap: '8px', minHeight: 0, marginBottom: '12px' }}>
            {/* Partner video card in PiP */}
            <div style={{ flex: 1, position: 'relative', background: '#14151f', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {partnerCameraOff ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <img 
                    src={partner?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner?.username}`} 
                    style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)' }} 
                  />
                  <span style={{ fontSize: '10px', color: '#adb5bd' }}>Tắt Camera</span>
                </div>
              ) : (
                <video 
                  ref={el => { if (el && partnerVideoRef.current && el.srcObject !== partnerVideoRef.current.srcObject) el.srcObject = partnerVideoRef.current.srcObject; }} 
                  autoPlay 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              )}
              <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>
                {partner?.username || 'Bạn học'}
              </div>
            </div>

            {/* Self video card in PiP */}
            <div style={{ flex: 1, position: 'relative', background: '#14151f', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {isVideoOff ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <img 
                    src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} 
                    style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)' }} 
                  />
                  <span style={{ fontSize: '10px', color: '#adb5bd' }}>Tắt Camera</span>
                </div>
              ) : (
                <video 
                  ref={el => { if (el && localVideoRef.current && el.srcObject !== localVideoRef.current.srcObject) el.srcObject = localVideoRef.current.srcObject; }} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              )}
              <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>
                Bạn {isMuted && '🔇'}
              </div>
            </div>
          </div>

          {/* Controls Footer */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
            {/* Toggle Mic */}
            <button 
              onClick={() => {
                if (streamRef.current) {
                  streamRef.current.getAudioTracks().forEach(track => track.enabled = isMuted);
                }
                setIsMuted(!isMuted);
              }}
              style={{
                background: isMuted ? '#fa5252' : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                transition: 'all 0.2s'
              }}
              title={isMuted ? "Bật Mic" : "Tắt Mic"}
            >
              <MicIcon />
            </button>

            {/* Toggle Cam */}
            <button 
              onClick={() => {
                const newVideoOff = !isVideoOff;
                if (streamRef.current) {
                  streamRef.current.getVideoTracks().forEach(track => track.enabled = !newVideoOff);
                }
                setIsVideoOff(newVideoOff);
                const socket = getSocket();
                socket.emit('camera_status', { roomId, isVideoOff: newVideoOff });
              }}
              style={{
                background: isVideoOff ? '#fa5252' : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                transition: 'all 0.2s'
              }}
              title={isVideoOff ? "Bật Camera" : "Tắt Camera"}
            >
              <VideoIcon />
            </button>

            {/* Close PiP button */}
            <button 
              onClick={() => {
                if (window.documentPictureInPicture.window) {
                  window.documentPictureInPicture.window.close();
                }
              }}
              style={{
                background: '#845ef7',
                border: 'none',
                borderRadius: '6px',
                padding: '0 12px',
                height: '34px',
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Đóng PiP
            </button>
          </div>
        </div>,
        pipWindowRef.current
      )}
    </div>
  );
}
