import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { connectSocket, getSocket } from '../services/socket';
import api from '../services/api';
import { FiSearch, FiBook, FiCrosshair, FiEdit3, FiUsers, FiAlertOctagon, FiX, FiZap, FiDatabase, FiGlobe, FiCpu } from 'react-icons/fi';
import { FaCalculator, FaNodeJs, FaReact, FaPython } from 'react-icons/fa';
import backgroundLogin from '../../background/backgroundLogin.png';
import mascot1 from '../../background/mascot1.png';
import mascot2 from '../../background/mascot2.png';
import mascot3 from '../../background/mascot3.png';
import './LobbyPage.css';

// Màu pastel cho từng card môn học (giống Figma)
const subjectColors = {
  math:      { bg: '#ffd6e0', icon: '#e64980' },
  nodejs:    { bg: '#d3f9d8', icon: '#2f9e44' },
  english:   { bg: '#e3fafc', icon: '#1098ad' },
  python:    { bg: '#fff3bf', icon: '#e67700' },
  react:     { bg: '#d0ebff', icon: '#1971c2' },
  database:  { bg: '#f3d9fa', icon: '#9c36b5' },
  algorithm: { bg: '#fff3bf', icon: '#e67700' },
  physics:   { bg: '#d3f9d8', icon: '#2f9e44' },
  triet:     { bg: '#e3fafc', icon: '#1098ad' },
  lichsu:    { bg: '#ffd6e0', icon: '#e64980' },
  diali:     { bg: '#d3f9d8', icon: '#2f9e44' },
};

const subjectIcons = {
  math:      <FaCalculator />,
  nodejs:    <FaNodeJs />,
  english:   <FiGlobe />,
  python:    <FaPython />,
  react:     <FaReact />,
  database:  <FiDatabase />,
  algorithm: <FiCpu />,
  physics:   <FiZap />,
  triet:     <FiBook />,
  lichsu:    <FiBook />,
  diali:     <FiGlobe />,
};

export default function LobbyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [queueStats, setQueueStats] = useState({});

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data } = await api.get('/subjects');
        if (data.success) setSubjects(data.subjects);
      } catch (err) {
        setSubjects([
          { id: 'math',      name: 'Toán học' },
          { id: 'triet',     name: 'Triết học' },
          { id: 'english',   name: 'Tiếng Anh' },
          { id: 'lichsu',    name: 'Lịch sử' },
          { id: 'diali',     name: 'Địa lí' },
          { id: 'database',  name: 'Cơ sở dữ liệu' },
          { id: 'algorithm', name: 'Thuật toán' },
          { id: 'physics',   name: 'Vật lý' },
        ]);
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    socket.on('matched', (data) => {
      setSearching(false); setSearchTime(0);
      navigate(`/room/${data.roomId}`, { state: { partner: data.partner, subject: data.subject } });
    });
    socket.on('waiting', (data) => { if (data.queueStats) setQueueStats(data.queueStats); });
    socket.on('queue_left', () => { setSearching(false); setSearchTime(0); });
    socket.on('queue_stats', (stats) => setQueueStats(stats));
    const interval = setInterval(() => socket.emit('get_queue_stats'), 5000);
    return () => { clearInterval(interval); socket.off('matched'); socket.off('waiting'); socket.off('queue_left'); socket.off('queue_stats'); };
  }, [navigate]);

  useEffect(() => {
    let timer;
    if (searching) timer = setInterval(() => setSearchTime((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [searching]);

  const handleSearch = useCallback(() => {
    if (!selectedSubject) return;
    const socket = getSocket();
    if (!socket.connected) connectSocket();
    setSearching(true); setSearchTime(0);
    socket.emit('join_queue', { subjectId: selectedSubject });
  }, [selectedSubject]);

  const handleCancelSearch = useCallback(() => {
    getSocket().emit('leave_queue');
    setSearching(false); setSearchTime(0);
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="lobby-page" style={{ backgroundImage: `url(${backgroundLogin})` }}>

      {/* Mascot trái dưới - mascot1 */}
      <div className="lobby-mascot-fixed lobby-mascot-left">
        <img src={mascot1} alt="Mascot 1" />
      </div>

      {/* Mascot phải dưới - mascot2 */}
      <div className="lobby-mascot-fixed lobby-mascot-right">
        <img src={mascot2} alt="Mascot 2" />
      </div>

      {/* Mascot bên cạnh nút tìm bạn học - mascot3 */}
      <div className="lobby-mascot-fixed lobby-mascot-center-right">
        <img src={mascot3} alt="Mascot 3" />
      </div>

      <div className="container lobby-container">

        {/* Header */}
        <div className="lobby-header animate-fade-in">
          <h1>
            Chào, <span className="lobby-name-highlight">{user?.displayName}</span>! 👋
          </h1>
          <p>Chọn môn học bạn muốn ôn tập và tìm bạn học ngay</p>
        </div>

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
              <p className="search-subject">Môn: <strong>{subjects.find(s => s.id === selectedSubject)?.name}</strong></p>
              <p className="search-time">{formatTime(searchTime)}</p>
              <p className="search-hint">Hệ thống đang tìm người cùng môn học với bạn</p>
              <button onClick={handleCancelSearch} className="btn-cancel-search">
                <FiX /> Hủy tìm kiếm
              </button>
            </div>
          </div>
        )}

        {/* Subjects Grid */}
        <div className="subjects-section">
          <h2 className="subjects-title">
            <span className="subjects-title-icon">🎓</span> Chọn Môn Học
          </h2>
          <div className="subjects-grid stagger-children">
            {subjects.map((subject) => {
              const color = subjectColors[subject.id] || { bg: '#e7f5ff', icon: '#339af0' };
              const icon  = subjectIcons[subject.id]  || <FiBook />;
              const isSelected = selectedSubject === subject.id;
              return (
                <button
                  key={subject.id}
                  className={`subject-card ${isSelected ? 'selected' : ''}`}
                  style={{ '--card-bg': color.bg, '--card-icon': color.icon }}
                  onClick={() => setSelectedSubject(subject.id)}
                  disabled={searching}
                >
                  <span className="subject-icon">{icon}</span>
                  <span className="subject-name">{subject.name}</span>
                  {(queueStats[subject.id] || subject.queueCount || 0) > 0 && (
                    <span className="queue-badge">
                      {queueStats[subject.id] || subject.queueCount} đang chờ
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Button + Mascot */}
        <div className="search-action animate-fade-in">
          <button
            onClick={handleSearch}
            className="btn-find-partner"
            disabled={!selectedSubject || searching}
          >
            <FiCrosshair /> Tìm Bạn Học
          </button>
          {selectedSubject && (
            <p className="search-info">
              Bạn đã chọn: <strong>{subjects.find(s => s.id === selectedSubject)?.name}</strong>
            </p>
          )}
          {/* <div className="lobby-mascot">
            <img src={mascot3} alt="Mascot" />
          </div> */}
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <div className="quick-card" onClick={() => navigate('/whiteboard')}>
            <span className="quick-icon quick-icon-purple">
              <FiEdit3 />
            </span>
            <div>
              <h3>Bảng Trắng</h3>
              <p>Giải bài tập cùng nhau</p>
            </div>
          </div>
          <div className="quick-card" onClick={() => navigate('/friends')}>
            <span className="quick-icon quick-icon-teal">
              <FiUsers />
            </span>
            <div>
              <h3>Bạn Bè</h3>
              <p>Xem danh sách bạn bè</p>
            </div>
          </div>
          <div className="quick-card" onClick={() => navigate('/report')}>
            <span className="quick-icon quick-icon-yellow">
              <FiAlertOctagon />
            </span>
            <div>
              <h3>Báo Cáo</h3>
              <p>Report hành vi xấu</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
