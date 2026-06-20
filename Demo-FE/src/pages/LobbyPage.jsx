import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { connectSocket, getSocket } from '../services/socket';
import api from '../services/api';
import {
  FiSearch, FiBook, FiCrosshair, FiUsers, FiAlertOctagon, FiX,
  FiZap, FiDatabase, FiGlobe, FiCpu, FiStar, FiBarChart2, FiCheck,
  FiDroplet, FiAward, FiEdit3, FiGrid, FiCode, FiTerminal,
  FiSmartphone, FiMonitor, FiTrendingUp, FiHeart, FiDollarSign,
  FiShield, FiSliders, FiMessageCircle, FiCoffee, FiTarget,
  FiBookOpen, FiLayers, FiCamera,
} from 'react-icons/fi';
import {
  FaCalculator, FaNodeJs, FaReact, FaPython, FaDna,
  FaJava, FaGraduationCap,
} from 'react-icons/fa';
import backgroundLogin from '../../background/backgroundLogin.png';
import mascot1 from '../../background/mascot1.png';
import mascot2 from '../../background/mascot2.png';
import './LobbyPage.css';

// ─── Màu pastel cho từng môn ────────────────────────────────────────────────
const subjectColors = {
  // Phổ thông — STEM
  math:      { bg: '#ffd6e0', icon: '#e64980' },
  physics:   { bg: '#d0ebff', icon: '#1971c2' },
  hoa:       { bg: '#fff3bf', icon: '#e67700' },
  sinh:      { bg: '#d3f9d8', icon: '#2f9e44' },
  tinhoc:    { bg: '#e7f5ff', icon: '#339af0' },
  // Phổ thông — Ngôn ngữ / Xã hội
  english:   { bg: '#e3fafc', icon: '#1098ad' },
  van:       { bg: '#f3d9fa', icon: '#9c36b5' },
  lichsu:    { bg: '#ffd6e0', icon: '#e64980' },
  diali:     { bg: '#d3f9d8', icon: '#2f9e44' },
  gdcd:      { bg: '#fff3bf', icon: '#e67700' },

  // Lập trình / CNTT (Đại học)
  python:    { bg: '#fff3bf', icon: '#e67700' },
  nodejs:    { bg: '#d3f9d8', icon: '#2f9e44' },
  react:     { bg: '#d0ebff', icon: '#1971c2' },
  database:  { bg: '#f3d9fa', icon: '#9c36b5' },
  algorithm: { bg: '#ffe8cc', icon: '#d9480f' },
  java:      { bg: '#ffd6e0', icon: '#c92a2a' },
  csharp:    { bg: '#e7e8fd', icon: '#5c7cfa' },
  cpp:       { bg: '#ffe8cc', icon: '#d9480f' },
  flutter:   { bg: '#e3fafc', icon: '#1098ad' },
  ai:        { bg: '#e9d5ff', icon: '#7c3aed' },
  mang_may_tinh: { bg: '#e7f5ff', icon: '#339af0' },
  an_toan_thong_tin: { bg: '#ffe3e3', icon: '#e03131' },

  // Đại học — Kinh tế / Quản lý
  triet:     { bg: '#e3fafc', icon: '#1098ad' },
  kinh_te:   { bg: '#d3f9d8', icon: '#2f9e44' },
  ke_toan:   { bg: '#fff3bf', icon: '#e67700' },
  marketing: { bg: '#fff0f6', icon: '#d6336c' },
  quan_tri:  { bg: '#f1f3f5', icon: '#495057' },

  // Đại học — Xã hội / Luật
  tam_ly:    { bg: '#ffd6e0', icon: '#e64980' },
  phap_luat: { bg: '#f3d9fa', icon: '#9c36b5' },
  xa_hoi_hoc: { bg: '#f4f2ff', icon: '#5f3dc4' },
  luat_dai_cuong: { bg: '#fff9db', icon: '#f08c00' },

  // Ngoại ngữ
  tieng_anh_gt: { bg: '#e7f5ff', icon: '#1c7ed6' },
  tieng_trung:  { bg: '#fff5f5', icon: '#e64980' },
  tieng_nhat:   { bg: '#fff0f6', icon: '#ae3ec9' },
  tieng_han:    { bg: '#ebfbee', icon: '#2b8a3e' },

  // Y học & Sức khỏe
  giai_phau:    { bg: '#fff5f5', icon: '#fa5252' },
  duoc_ly:      { bg: '#e6fffa', icon: '#0c8599' },
  dinh_duong:   { bg: '#fffbeb', icon: '#d97706' },

  // Mỹ thuật & Thiết kế
  graphic_design: { bg: '#f8f0fc', icon: '#ae3ec9' },
  ux_ui:          { bg: '#e7f5ff', icon: '#1c7ed6' },
  nhiep_anh:      { bg: '#fff9db', icon: '#fab005' },
};

const subjectIcons = {
  math:      <FaCalculator />,
  physics:   <FiZap />,
  hoa:       <FiDroplet />,
  sinh:      <FaDna />,
  tinhoc:    <FiMonitor />,
  english:   <FiGlobe />,
  van:       <FiEdit3 />,
  lichsu:    <FiBook />,
  diali:     <FiGlobe />,
  gdcd:      <FiAward />,
  python:    <FaPython />,
  nodejs:    <FaNodeJs />,
  react:     <FaReact />,
  database:  <FiDatabase />,
  algorithm: <FiCpu />,
  java:      <FaJava />,
  csharp:    <FiCode />,
  cpp:       <FiTerminal />,
  flutter:   <FiSmartphone />,
  ai:        <FiLayers />,
  mang_may_tinh: <FiGlobe />,
  an_toan_thong_tin: <FiShield />,
  triet:     <FiBook />,
  kinh_te:   <FiTrendingUp />,
  tam_ly:    <FiHeart />,
  ke_toan:   <FiDollarSign />,
  phap_luat: <FiShield />,
  marketing: <FiBarChart2 />,
  quan_tri:  <FiUsers />,
  xa_hoi_hoc: <FiBookOpen />,
  luat_dai_cuong: <FiShield />,

  // Ngoại ngữ
  tieng_anh_gt: <FiGlobe />,
  tieng_trung:  <FiBookOpen />,
  tieng_nhat:   <FiBook />,
  tieng_han:    <FiEdit3 />,

  // Y tế
  giai_phau:    <FiHeart />,
  duoc_ly:      <FiDroplet />,
  dinh_duong:   <FiCoffee />,

  // Thiết kế
  graphic_design: <FiLayers />,
  ux_ui:          <FiSmartphone />,
  nhiep_anh:      <FiCamera />,
};

// ─── Danh mục môn học ────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'all',
    label: 'Tất cả',
    icon: <FiGrid />,
    subjectIds: null,
  },
  {
    id: 'pho_thong',
    label: 'Phổ thông',
    icon: <FiBookOpen />,
    subjectIds: ['math', 'physics', 'hoa', 'sinh', 'tinhoc', 'english', 'van', 'lichsu', 'diali', 'gdcd'],
  },
  {
    id: 'dai_hoc',
    label: 'Đại học',
    icon: <FaGraduationCap />,
    subjectIds: [
      // CNTT
      'python', 'nodejs', 'react', 'database', 'algorithm', 'java', 'csharp', 'cpp', 'flutter', 'ai', 'mang_may_tinh', 'an_toan_thong_tin',
      // Kinh tế
      'triet', 'kinh_te', 'ke_toan', 'marketing', 'quan_tri',
      // Xã hội & Luật
      'tam_ly', 'phap_luat', 'xa_hoi_hoc', 'luat_dai_cuong',
      // Ngoại ngữ
      'tieng_anh_gt', 'tieng_trung', 'tieng_nhat', 'tieng_han',
      // Y dược
      'giai_phau', 'duoc_ly', 'dinh_duong',
      // Thiết kế
      'graphic_design', 'ux_ui', 'nhiep_anh'
    ],
  },
];

// Sections cho các môn Đại học
const UNIVERSITY_SECTIONS = [
  {
    key: 'cntt',
    label: 'Công nghệ thông tin',
    icon: <FiCode />,
    subjectIds: ['python', 'nodejs', 'react', 'database', 'algorithm', 'java', 'csharp', 'cpp', 'flutter', 'ai', 'mang_may_tinh', 'an_toan_thong_tin'],
  },
  {
    key: 'kinh_te_quan_ly',
    label: 'Kinh tế & Quản lý',
    icon: <FiTrendingUp />,
    subjectIds: ['triet', 'kinh_te', 'ke_toan', 'marketing', 'quan_tri'],
  },
  {
    key: 'xa_hoi_luat',
    label: 'Khoa học Xã hội & Luật',
    icon: <FiShield />,
    subjectIds: ['tam_ly', 'phap_luat', 'xa_hoi_hoc', 'luat_dai_cuong'],
  },
  {
    key: 'ngoai_ngu',
    label: 'Ngoại ngữ & Ngôn ngữ',
    icon: <FiGlobe />,
    subjectIds: ['tieng_anh_gt', 'tieng_trung', 'tieng_nhat', 'tieng_han'],
  },
  {
    key: 'y_duoc',
    label: 'Y học & Sức khỏe',
    icon: <FiHeart />,
    subjectIds: ['giai_phau', 'duoc_ly', 'dinh_duong'],
  },
  {
    key: 'thiet_ke',
    label: 'Mỹ thuật & Thiết kế',
    icon: <FiCamera />,
    subjectIds: ['graphic_design', 'ux_ui', 'nhiep_anh'],
  },
];

// Sections cho tab "Tất cả"
const ALL_SECTIONS = [
  {
    key: 'pho_thong',
    label: 'Phổ thông',
    icon: <FiBookOpen />,
    subjectIds: ['math', 'physics', 'hoa', 'sinh', 'tinhoc', 'english', 'van', 'lichsu', 'diali', 'gdcd'],
  },
  ...UNIVERSITY_SECTIONS
];

// ─── Tiêu chí ghép cặp (icon từ thư viện) ───────────────────────────────────
const SKILL_OPTIONS = [
  { value: 'any',          label: 'Bất kỳ',    cls: 'cb-gray',   icon: <FiSliders />,    desc: 'Không quan trọng trình độ' },
  { value: 'beginner',     label: 'Cơ bản',    cls: 'cb-green',  icon: <FiBookOpen />,   desc: 'Mới bắt đầu học môn này' },
  { value: 'intermediate', label: 'Trung cấp', cls: 'cb-yellow', icon: <FiTrendingUp />, desc: 'Đã nắm được kiến thức cơ bản' },
  { value: 'advanced',     label: 'Nâng cao',  cls: 'cb-red',    icon: <FiTarget />,     desc: 'Muốn thách thức với bài khó' },
];

const GOAL_OPTIONS = [
  { value: 'any',        label: 'Bất kỳ',    cls: 'cb-gray',   icon: <FiSliders />,       desc: 'Không quan trọng hình thức học' },
  { value: 'practice',   label: 'Luyện bài', cls: 'cb-blue',   icon: <FiEdit3 />,         desc: 'Ôn tập, giải bài tập cùng nhau' },
  { value: 'discuss',    label: 'Thảo luận', cls: 'cb-purple', icon: <FiMessageCircle />, desc: 'Hỏi đáp, trao đổi kiến thức' },
  { value: 'self_study', label: 'Tự học',    cls: 'cb-teal',   icon: <FiBook />,          desc: 'Học song song, không cần giải thích' },
  { value: 'casual',     label: 'Thoải mái', cls: 'cb-yellow', icon: <FiCoffee />,        desc: 'Học nhẹ nhàng, vừa học vừa vui' },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function LobbyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searching, setSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [queueStats, setQueueStats] = useState({});

  // ---- Chế độ ghép cặp ----
  const [matchMode, setMatchMode] = useState('subject'); // 'subject' | 'quick'

  // ---- Criteria state ----
  const [skillLevel, setSkillLevel] = useState('any');
  const [sessionGoal, setSessionGoal] = useState('any');
  const [relaxLevel, setRelaxLevel] = useState(0);

  // ---- Quick match searching state ----
  const [quickSearching, setQuickSearching] = useState(false);
  const [quickSearchTime, setQuickSearchTime] = useState(0);

  // ---- Premium state ----
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [refundNotification, setRefundNotification] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data } = await api.get('/premium/status');
        if (data.success) setPremiumStatus(data);
      } catch (_) {}
    };
    fetchStatus();
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data } = await api.get('/subjects');
        if (data.success) setSubjects(data.subjects);
      } catch (err) {
        setSubjects([
          // Phổ thông — STEM
          { id: 'math',      name: 'Toán học' },
          { id: 'physics',   name: 'Vật lý' },
          { id: 'hoa',       name: 'Hóa học' },
          { id: 'sinh',      name: 'Sinh học' },
          { id: 'tinhoc',    name: 'Tin học' },
          // Phổ thông — Ngôn ngữ / Xã hội
          { id: 'english',   name: 'Tiếng Anh' },
          { id: 'van',       name: 'Ngữ văn' },
          { id: 'lichsu',    name: 'Lịch sử' },
          { id: 'diali',     name: 'Địa lí' },
          { id: 'gdcd',      name: 'GDCD' },
          // Lập trình
          { id: 'python',    name: 'Python' },
          { id: 'nodejs',    name: 'NodeJS' },
          { id: 'react',     name: 'React' },
          { id: 'database',  name: 'Cơ sở dữ liệu' },
          { id: 'algorithm', name: 'Thuật toán' },
          { id: 'java',      name: 'Java' },
          { id: 'csharp',    name: 'C#' },
          { id: 'cpp',       name: 'C/C++' },
          { id: 'flutter',   name: 'Flutter' },
          { id: 'ai',        name: 'AI / ML' },
          { id: 'mang_may_tinh', name: 'Mạng máy tính' },
          { id: 'an_toan_thong_tin', name: 'An toàn thông tin' },
          // Đại học
          { id: 'triet',     name: 'Triết học' },
          { id: 'kinh_te',   name: 'Kinh tế' },
          { id: 'tam_ly',    name: 'Tâm lý học' },
          { id: 'ke_toan',   name: 'Kế toán' },
          { id: 'phap_luat', name: 'Pháp luật' },
          { id: 'marketing', name: 'Marketing' },
          { id: 'quan_tri',  name: 'Quản trị kinh doanh' },
          { id: 'xa_hoi_hoc', name: 'Xã hội học' },
          { id: 'luat_dai_cuong', name: 'Luật đại cương' },
          // Ngoại ngữ
          { id: 'tieng_anh_gt', name: 'Tiếng Anh giao tiếp' },
          { id: 'tieng_trung',  name: 'Tiếng Trung' },
          { id: 'tieng_nhat',   name: 'Tiếng Nhật' },
          { id: 'tieng_han',    name: 'Tiếng Hàn' },
          // Y dược
          { id: 'giai_phau',    name: 'Giải phẫu học' },
          { id: 'duoc_ly',      name: 'Dược lý học' },
          { id: 'dinh_duong',   name: 'Dinh dưỡng học' },
          // Thiết kế
          { id: 'graphic_design', name: 'Thiết kế đồ họa' },
          { id: 'ux_ui',          name: 'Thiết kế UX/UI' },
          { id: 'nhiep_anh',      name: 'Nhiếp ảnh cơ bản' },
        ]);
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    socket.on('matched', (data) => {
      setSearching(false); setSearchTime(0); setRelaxLevel(0);
      setQuickSearching(false); setQuickSearchTime(0);
      navigate(`/room/${data.roomId}`, {
        state: { partner: data.partner, subject: data.subject, sessionTimeLimit: data.sessionTimeLimit }
      });
    });
    socket.on('waiting', (data) => {
      if (data.queueStats) setQueueStats(data.queueStats);
      // waiting cho cả quick và normal mode - stats được xử lý qua queue_stats broadcast
    });
    socket.on('queue_left', () => { setSearching(false); setSearchTime(0); setRelaxLevel(0); setQuickSearching(false); setQuickSearchTime(0); });
    socket.on('queue_stats', (stats) => setQueueStats(stats));
    socket.on('queue_relaxed', (data) => { setRelaxLevel(data.level); });
    socket.on('match_limit_reached', () => {
      setSearching(false); setSearchTime(0); setRelaxLevel(0);
      setQuickSearching(false); setQuickSearchTime(0);
      setLimitReached(true);
    });
    socket.on('match_refunded', (data) => {
      setRefundNotification(data.message);
      setTimeout(() => setRefundNotification(null), 8000);
      setPremiumStatus(prev => {
        if (!prev || prev.isPremium) return prev;
        return { ...prev, limits: { ...prev.limits, dailyMatchesUsed: data.dailyMatchCount, dailyMatchesRemaining: data.remaining } };
      });
    });
    const interval = setInterval(() => socket.emit('get_queue_stats'), 5000);
    return () => {
      clearInterval(interval);
      socket.off('matched'); socket.off('waiting'); socket.off('queue_left');
      socket.off('queue_stats'); socket.off('match_limit_reached');
      socket.off('match_refunded'); socket.off('queue_relaxed');
    };
  }, [navigate]);

  useEffect(() => {
    let timer;
    if (searching) timer = setInterval(() => setSearchTime((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [searching]);

  useEffect(() => {
    let timer;
    if (quickSearching) timer = setInterval(() => setQuickSearchTime((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [quickSearching]);

  const handleSearch = useCallback(() => {
    if (!selectedSubject) return;
    setLimitReached(false); setRelaxLevel(0);
    const socket = getSocket();
    if (!socket.connected) connectSocket();
    setSearching(true); setSearchTime(0);
    socket.emit('join_queue', { subjectId: selectedSubject, skillLevel, goal: sessionGoal });
  }, [selectedSubject, skillLevel, sessionGoal]);

  const handleSearchInstant = useCallback(() => {
    const socket = getSocket();
    setRelaxLevel(0);
    socket.emit('join_queue', { subjectId: selectedSubject, skillLevel: 'any', goal: 'any' });
  }, [selectedSubject]);

  const handleCancelSearch = useCallback(() => {
    getSocket().emit('leave_queue');
    setSearching(false); setSearchTime(0); setRelaxLevel(0);
  }, []);

  const handleQuickMatch = useCallback(() => {
    setLimitReached(false);
    const socket = getSocket();
    if (!socket.connected) connectSocket();
    setQuickSearching(true); setQuickSearchTime(0);
    socket.emit('join_quick_queue');
  }, []);

  const handleCancelQuickSearch = useCallback(() => {
    getSocket().emit('leave_queue'); // removeFromQueue hoạt động với mọi queue
    setQuickSearching(false); setQuickSearchTime(0);
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;


  // ─── Derived ─────────────────────────────────────────────────────────────
  const hasAnyFilter = skillLevel !== 'any' || sessionGoal !== 'any';
  const selectedSubjectData = subjects.find(s => s.id === selectedSubject);
  const selectedColor = selectedSubject ? (subjectColors[selectedSubject] || { bg: '#e7f5ff', icon: '#339af0' }) : null;
  const selectedIcon  = selectedSubject ? (subjectIcons[selectedSubject]  || <FiBook />) : null;
  const skillOption = SKILL_OPTIONS.find(o => o.value === skillLevel);
  const goalOption  = GOAL_OPTIONS.find(o => o.value === sessionGoal);

  const summaryParts = [
    selectedSubjectData?.name,
    skillLevel !== 'any' ? skillOption?.label : null,
    sessionGoal !== 'any' ? goalOption?.label : null,
  ].filter(Boolean);

  const filteredSubjects = activeCategory === 'all'
    ? subjects
    : subjects.filter(s => CATEGORIES.find(c => c.id === activeCategory)?.subjectIds?.includes(s.id));

  const hasInfiniteMatches =
    premiumStatus?.limits?.dailyMatches === Infinity ||
    premiumStatus?.limits?.dailyMatches === null ||
    ['pro', 'ultimate'].includes(premiumStatus?.premiumTier);
  const remaining = premiumStatus?.limits?.dailyMatchesRemaining;
  const tierName = premiumStatus?.premiumTier || 'none';

  // ─── Helper: render 1 subject card ─────────────────────────────────────
  const renderCard = (subject) => {
    const color      = subjectColors[subject.id] || { bg: '#e7f5ff', icon: '#339af0' };
    const icon       = subjectIcons[subject.id]  || <FiBook />;
    const isSelected = selectedSubject === subject.id;
    const queueCount = queueStats[subject.id] || subject.queueCount || 0;
    return (
      <button
        key={subject.id}
        className={`subject-card ${isSelected ? 'selected' : ''}`}
        style={{ '--card-bg': color.bg, '--card-icon': color.icon }}
        onClick={() => setSelectedSubject(subject.id)}
        disabled={searching}
        title={subject.name}
      >
        {isSelected && <span className="subject-check"><FiCheck /></span>}
        <span className="subject-icon">{icon}</span>
        <span className="subject-name">{subject.name}</span>
        {queueCount > 0 && <span className="queue-badge">{queueCount}</span>}
      </button>
    );
  };

  // ─── Render các môn học theo từng section chuyên ngành ──────────────────
  const renderSections = (sectionsList) =>
    sectionsList.map(sec => {
      const secSubjects = subjects.filter(s => sec.subjectIds.includes(s.id));
      if (secSubjects.length === 0) return null;
      return (
        <div key={sec.key} className="subject-section">
          <div className="subject-section-header">
            <span className="sec-icon">{sec.icon}</span>
            {sec.label}
            <span className="sec-count">{secSubjects.length} môn</span>
          </div>
          <div className="subjects-grid">{secSubjects.map(renderCard)}</div>
        </div>
      );
    });

  // ─── JSX ────────────────────────────────────────────────────────────────
  return (
    <div className="lobby-page" style={{ backgroundImage: `url(${backgroundLogin})` }}>

      {/* Refund Toast */}
      {refundNotification && (
        <div className="lobby-refund-toast animate-fade-in">
          <span className="toast-icon">💸</span>
          <div className="toast-content">
            <h3>Hoàn lượt ghép bạn!</h3>
            <p>{refundNotification}</p>
          </div>
          <button className="toast-close" onClick={() => setRefundNotification(null)}><FiX /></button>
        </div>
      )}

      {/* Mascots */}
      <div className="lobby-mascot-fixed lobby-mascot-left"><img src={mascot1} alt="" /></div>
      <div className="lobby-mascot-fixed lobby-mascot-right"><img src={mascot2} alt="" /></div>

      <div className="container lobby-container">

        {/* Header */}
        <div className="lobby-header animate-fade-in">
          <h1>Chào, <span className="lobby-name-highlight">{user?.displayName}</span>! 👋</h1>
          <div className="lobby-header-sub">
            <p>Chọn môn học và thiết lập phiên học để tìm bạn học phù hợp</p>
            <span className="lobby-reputation-pill">
              <FiStar style={{ color: '#f59f00' }} />
              <strong style={{ color: '#f59f00' }}>
                {user?.reputation !== undefined ? Number(user.reputation).toFixed(1) : '5.0'}
              </strong> / 5.0
              <span className="rep-count">({user?.ratingCount || 0} đánh giá)</span>
            </span>
          </div>
        </div>

        {/* === TAB SWITCHER: Chế độ ghép cặp === */}
        <div className="match-mode-tabs animate-fade-in">
          <button
            className={`mode-tab ${matchMode === 'subject' ? 'active' : ''}`}
            onClick={() => { setMatchMode('subject'); if (quickSearching) handleCancelQuickSearch(); }}
            disabled={searching || quickSearching}
          >
            <FiCrosshair size={15} />
            Tìm theo Môn học
          </button>
          <button
            className={`mode-tab mode-tab-quick ${matchMode === 'quick' ? 'active' : ''}`}
            onClick={() => { setMatchMode('quick'); if (searching) handleCancelSearch(); }}
            disabled={searching || quickSearching}
          >
            <FiZap size={15} />
            Ghép Nhanh
            {(queueStats['__quick__'] || 0) > 0 && (
              <span className="mode-tab-badge">{queueStats['__quick__']}</span>
            )}
          </button>
        </div>

        {/* Premium banners */}
        {premiumStatus && !hasInfiniteMatches && (
          <div className="lobby-quota-banner animate-fade-in">
            <div className="quota-info">
              <span className="quota-label">Lượt tìm hôm nay ({['none','free'].includes(tierName) ? 'Free' : tierName}):</span>
              <span className={`quota-count ${remaining === 0 ? 'depleted' : ''}`}>{remaining ?? '…'} / {premiumStatus.limits?.dailyMatches}</span>
            </div>
            <Link to="/pricing" className="quota-upgrade-btn"><FiStar /> Nâng cấp</Link>
          </div>
        )}
        {premiumStatus && hasInfiniteMatches && (
          <div className="lobby-premium-badge animate-fade-in">
            👑 <span>Premium {tierName}</span> — Không giới hạn lượt tìm &amp; thời gian học!
          </div>
        )}

        {/* Limit Reached Modal */}
        {limitReached && (
          <div className="search-overlay animate-fade-in">
            <div className="search-modal limit-modal">
              <div className="limit-icon">🔒</div>
              <h2>Hết lượt tìm bạn học!</h2>
              <p className="limit-desc">Bạn đã dùng hết <strong>{premiumStatus?.limits?.dailyMatches || 3} lượt</strong> miễn phí hôm nay.</p>
              <p className="limit-hint">Nâng cấp Premium — mua 1 lần dùng vĩnh viễn!</p>
              <div className="limit-actions">
                <Link to="/pricing" className="btn-find-partner" style={{ textDecoration: 'none' }}><FiStar /> Xem gói Premium</Link>
                <button onClick={() => setLimitReached(false)} className="btn-cancel-search" style={{ marginTop: 8 }}><FiX /> Đóng</button>
              </div>
            </div>
          </div>
        )}

        {/* Searching Overlay */}
        {searching && (
          <div className="search-overlay animate-fade-in">
            <div className="search-modal">
              <div className="search-animation">
                <div className="search-ripple">
                  <div className="ripple-ring ripple-ring-1"></div>
                  <div className="ripple-ring ripple-ring-2"></div>
                  <div className="ripple-ring ripple-ring-3"></div>
                  <div className="search-icon-center"><FiSearch /></div>
                </div>
              </div>
              <h2>Đang tìm bạn học...</h2>
              <p className="search-subject">Môn: <strong>{selectedSubjectData?.name}</strong></p>
              <p className="search-time">{formatTime(searchTime)}</p>
              {hasAnyFilter && (
                <div className="search-criteria-tags">
                  {skillLevel !== 'any' && (
                    <span className="search-criteria-tag">
                      <span className="tag-icon">{skillOption?.icon}</span>
                      {skillOption?.label}
                    </span>
                  )}
                  {sessionGoal !== 'any' && (
                    <span className="search-criteria-tag">
                      <span className="tag-icon">{goalOption?.icon}</span>
                      {goalOption?.label}
                    </span>
                  )}
                </div>
              )}
              <div className="smart-queue-stats">
                <div className="smart-queue-stat-row">
                  <FiUsers />
                  <span><span className="stat-val">{queueStats[selectedSubject] || 0}</span> người đang chờ môn này</span>
                </div>
                {hasAnyFilter && (
                  <div className="smart-queue-stat-row">
                    <FiTarget />
                    <span>Đang tìm người khớp tiêu chí của bạn...</span>
                  </div>
                )}
              </div>
              {relaxLevel === 1 && <div className="relax-badge level-1"><FiSliders /> Đang mở rộng tìm kiếm (bỏ lọc mục tiêu)</div>}
              {relaxLevel === 2 && <div className="relax-badge level-2"><FiLayers /> Tìm kiếm không giới hạn tiêu chí</div>}
              {hasAnyFilter && relaxLevel === 0 && (
                <button onClick={handleSearchInstant} className="btn-search-instant">
                  <FiZap /> Tìm ngay không lọc
                </button>
              )}
              <button onClick={handleCancelSearch} className="btn-cancel-search"><FiX /> Hủy tìm kiếm</button>
            </div>
          </div>
        )}

        {/* Quick Searching Overlay */}
        {quickSearching && (
          <div className="search-overlay animate-fade-in">
            <div className="search-modal quick-search-modal">
              <div className="search-animation">
                <div className="search-ripple quick-ripple">
                  <div className="ripple-ring ripple-ring-1"></div>
                  <div className="ripple-ring ripple-ring-2"></div>
                  <div className="ripple-ring ripple-ring-3"></div>
                  <div className="search-icon-center quick-search-icon-center"><FiZap /></div>
                </div>
              </div>
              <h2 className="quick-search-title">Ghép Nhanh...</h2>
              <p className="search-subject">Hệ thống đang kết nối bạn với bất kỳ ai online</p>
              <p className="search-time">{formatTime(quickSearchTime)}</p>
              <div className="smart-queue-stats">
                <div className="smart-queue-stat-row">
                  <FiUsers />
                  <span><span className="stat-val">{queueStats['__quick__'] || 0}</span> người đang chờ Ghép Nhanh</span>
                </div>
                <div className="smart-queue-stat-row">
                  <FiZap />
                  <span>Không có bộ lọc — ghép ngay khi có người!</span>
                </div>
              </div>
              <button onClick={handleCancelQuickSearch} className="btn-cancel-search"><FiX /> Hủy tìm kiếm</button>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        {matchMode === 'subject' ? (
          <>
            {/* ── MAIN 2-COLUMN GRID (subject mode) ── */}
            <div className="lobby-main-grid">

              {/* CỘT TRÁI: Chọn môn học */}
              <div className="lobby-left animate-fade-in">
                <div className="lobby-left-panel">
                  <div className="left-panel-header">
                    <h2 className="subjects-title"><FiBookOpen /> Chọn Môn Học</h2>
                  </div>

                  {/* Category tabs */}
                  <div className="category-tabs">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat.id)}
                        disabled={searching}
                      >
                        <span className="cat-icon">{cat.icon}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Subjects */}
                  <div className="subjects-scroll-area">
                    {activeCategory === 'all' ? (
                      renderSections(ALL_SECTIONS)
                    ) : activeCategory === 'dai_hoc' ? (
                      renderSections(UNIVERSITY_SECTIONS)
                    ) : (
                      filteredSubjects.length === 0 ? (
                        <div className="subjects-empty">Không có môn học trong danh mục này</div>
                      ) : (
                        <div className="subjects-grid">{filteredSubjects.map(renderCard)}</div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI: Thiết lập & Tìm bạn */}
              <div className="lobby-right animate-fade-in">
                <div className="lobby-right-panel">

                  {/* Môn đã chọn */}
                  <div className="right-section">
                    <div className="right-section-label"><FiSearch size={11} /> Môn học đã chọn</div>
                    {selectedSubjectData ? (
                      <div className="selected-subject-card" style={{ '--card-bg': selectedColor.bg, '--card-icon': selectedColor.icon }}>
                        <span className="selected-subject-icon">{selectedIcon}</span>
                        <div className="selected-subject-info">
                          <span className="selected-subject-name">{selectedSubjectData.name}</span>
                          {(queueStats[selectedSubject] || 0) > 0 ? (
                            <span className="selected-subject-queue"><FiUsers size={11} /> {queueStats[selectedSubject]} người đang chờ</span>
                          ) : (
                            <span className="selected-subject-queue no-queue">Bạn sẽ là người đầu tiên!</span>
                          )}
                        </div>
                        <span className="selected-check-badge"><FiCheck /></span>
                      </div>
                    ) : (
                      <div className="selected-subject-placeholder">
                        <span className="placeholder-arrow"><FiBookOpen /></span>
                        <span>Chọn một môn học bên trái để bắt đầu</span>
                      </div>
                    )}
                  </div>

                  <div className="right-divider" />

                  {/* Trình độ */}
                  <div className="right-section">
                    <div className="right-section-label"><FiTrendingUp size={11} /> Trình độ của bạn</div>
                    <div className="criteria-options">
                      {SKILL_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          className={`criteria-btn ${opt.cls} ${skillLevel === opt.value ? 'selected' : ''}`}
                          onClick={() => setSkillLevel(opt.value)}
                          disabled={searching}
                          title={opt.desc}
                        >
                          <span className="btn-icon">{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="right-divider" />

                  {/* Mục tiêu */}
                  <div className="right-section">
                    <div className="right-section-label"><FiTarget size={11} /> Mục tiêu buổi học</div>
                    <div className="criteria-options">
                      {GOAL_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          className={`criteria-btn ${opt.cls} ${sessionGoal === opt.value ? 'selected' : ''}`}
                          onClick={() => setSessionGoal(opt.value)}
                          disabled={searching}
                          title={opt.desc}
                        >
                          <span className="btn-icon">{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

            </div>{/* end lobby-main-grid */}

            {/* Nút tìm kiếm lớn bên dưới grid */}
            <div className="lobby-search-action-area animate-fade-in">
              <button
                onClick={handleSearch}
                className="btn-find-partner"
                disabled={!selectedSubject || searching}
              >
                <FiCrosshair /> Tìm Bạn Học Ngay
              </button>
              <p className="search-summary-text">
                {summaryParts.length > 0 ? summaryParts.join(' · ') : 'Chọn môn học để bắt đầu tìm kiếm'}
              </p>
            </div>
          </>
        ) : (
          /* ── QUICK MATCH PANEL ── */
          <div className="quick-match-panel animate-fade-in">
            <div className="quick-match-visual">
              <div className="quick-pulse-ring qpr-1"></div>
              <div className="quick-pulse-ring qpr-2"></div>
              <div className="quick-pulse-ring qpr-3"></div>
              <div className="quick-center-icon">
                <FiZap />
              </div>
            </div>

            <div className="quick-match-content">
              <h2 className="quick-match-title">Ghép Nhanh</h2>
              <p className="quick-match-desc">
                Kết nối ngay với bất kỳ ai đang online —<br />
                không cần chọn môn, không cần tiêu chí.
              </p>

              <div className="quick-info-cards">
                <div className="quick-info-card">
                  <FiUsers className="qi-icon" />
                  <div>
                    <span className="qi-number">{queueStats['__quick__'] || 0}</span>
                    <span className="qi-label">người đang chờ</span>
                  </div>
                </div>
                <div className="quick-info-card">
                  <FiZap className="qi-icon" />
                  <div>
                    <span className="qi-number">&lt;1s</span>
                    <span className="qi-label">nếu có người</span>
                  </div>
                </div>
                <div className="quick-info-card">
                  <FiHeart className="qi-icon" />
                  <div>
                    <span className="qi-number">Miễn phí</span>
                    <span className="qi-label">cho tất cả</span>
                  </div>
                </div>
              </div>

              <div className="quick-features">
                <span className="quick-feature-tag"><FiCheck /> Không cần chọn môn</span>
                <span className="quick-feature-tag"><FiCheck /> Ghép ngay lập tức</span>
                <span className="quick-feature-tag"><FiCheck /> Học Tự Do 🎓</span>
              </div>

              <button
                onClick={handleQuickMatch}
                className="btn-quick-match"
                disabled={quickSearching}
              >
                <FiZap /> Ghép Ngay!
              </button>

              <p className="quick-note">
                💡 Quick Match tính vào lượt ghép hàng ngày
                {!hasInfiniteMatches && remaining !== undefined && (
                  <> &bull; Còn <strong>{remaining}</strong> lượt hôm nay</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Quick Actions — bên dưới grid */}
        <div className="lobby-quick-actions animate-fade-in">
          <div className="lobby-quick-card" onClick={() => navigate('/friends')}>
            <span className="quick-card-icon quick-icon-teal"><FiUsers /></span>
            <div className="quick-card-text">
              <h3>Bạn Bè</h3>
              <p>Xem danh sách bạn bè</p>
            </div>
          </div>
          <div className="lobby-quick-card" onClick={() => navigate('/stats')}>
            <span className="quick-card-icon quick-icon-blue"><FiBarChart2 /></span>
            <div className="quick-card-text">
              <h3>Thống Kê</h3>
              <p>Thành tích học tập</p>
            </div>
          </div>
          <div className="lobby-quick-card" onClick={() => navigate('/report')}>
            <span className="quick-card-icon quick-icon-yellow"><FiAlertOctagon /></span>
            <div className="quick-card-text">
              <h3>Báo Cáo</h3>
              <p>Report hành vi xấu</p>
            </div>
          </div>
        </div>

      </div>{/* end lobby-container */}
    </div>
  );
}
