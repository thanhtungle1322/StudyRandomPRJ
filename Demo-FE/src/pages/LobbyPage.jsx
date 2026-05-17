import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { connectSocket, getSocket } from '../services/socket';
import api from '../services/api';
import { FiSearch, FiBook, FiCrosshair, FiEdit3, FiUsers, FiAlertOctagon, FiX, FiSmile, FiZap, FiDatabase, FiGlobe, FiCpu, FiCode, FiHash } from 'react-icons/fi';
import { FaCalculator, FaNodeJs, FaReact, FaPython } from 'react-icons/fa';
import './LobbyPage.css';

// Icon mapping cho từng môn học (có màu riêng)
const subjectIcons = {
  math: <FaCalculator style={{ color: '#ff6b6b' }} />,
  nodejs: <FaNodeJs style={{ color: '#68a063' }} />,
  english: <FiGlobe style={{ color: '#339af0' }} />,
  python: <FaPython style={{ color: '#ffd43b' }} />,
  react: <FaReact style={{ color: '#61dafb' }} />,
  database: <FiDatabase style={{ color: '#845ef7' }} />,
  algorithm: <FiCpu style={{ color: '#ff922b' }} />,
  physics: <FiZap style={{ color: '#fcc419' }} />,
  triet: <FiBook style={{ color: '#20c997' }} />,
  lichsu: <FiBook style={{ color: '#e67700' }} />,
  diali: <FiGlobe style={{ color: '#51cf66' }} />,
};

export default function LobbyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [queueStats, setQueueStats] = useState({});

  // Fetch danh sách môn học
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data } = await api.get('/subjects');
        if (data.success) {
          setSubjects(data.subjects);
        }
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
        // Fallback subjects
        setSubjects([
          { id: 'math', name: 'Toán học', queueCount: 0 },
          { id: 'nodejs', name: 'Lập trình NodeJS', queueCount: 0 },
          { id: 'english', name: 'Tiếng Anh', queueCount: 0 },
          { id: 'python', name: 'Lập trình Python', queueCount: 0 },
          { id: 'react', name: 'React / Frontend', queueCount: 0 },
          { id: 'database', name: 'Cơ sở dữ liệu', queueCount: 0 },
          { id: 'algorithm', name: 'Thuật toán', queueCount: 0 },
          { id: 'physics', name: 'Vật lý', queueCount: 0 },
        ]);
      }
    };
    fetchSubjects();
  }, []);

  // Socket setup
  useEffect(() => {
    const socket = connectSocket();

    socket.on('matched', (data) => {
      console.log('Matched!', data);
      setSearching(false);
      setSearchTime(0);
      // Navigate to study room
      navigate(`/room/${data.roomId}`, {
        state: {
          partner: data.partner,
          subject: data.subject,
        },
      });
    });

    socket.on('waiting', (data) => {
      console.log('Waiting...', data);
      if (data.queueStats) {
        setQueueStats(data.queueStats);
      }
    });

    socket.on('queue_left', () => {
      setSearching(false);
      setSearchTime(0);
    });

    socket.on('queue_stats', (stats) => {
      setQueueStats(stats);
    });

    // Poll queue stats
    const interval = setInterval(() => {
      socket.emit('get_queue_stats');
    }, 5000);

    return () => {
      clearInterval(interval);
      socket.off('matched');
      socket.off('waiting');
      socket.off('queue_left');
      socket.off('queue_stats');
    };
  }, [navigate]);

  // Search timer
  useEffect(() => {
    let timer;
    if (searching) {
      timer = setInterval(() => {
        setSearchTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [searching]);

  const handleSearch = useCallback(() => {
    if (!selectedSubject) return;

    const socket = getSocket();
    if (!socket.connected) {
      connectSocket();
    }

    setSearching(true);
    setSearchTime(0);

    socket.emit('join_queue', {
      subjectId: selectedSubject,
    });
  }, [selectedSubject]);

  const handleCancelSearch = useCallback(() => {
    const socket = getSocket();
    socket.emit('leave_queue');
    setSearching(false);
    setSearchTime(0);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="lobby-page">
      <div className="lobby-bg">
        <div className="lobby-orb lobby-orb-1"></div>
        <div className="lobby-orb lobby-orb-2"></div>
      </div>

      <div className="container">
        {/* Header */}
        <div className="lobby-header animate-fade-in">
          <h1>Chào, <span className="gradient-text">{user?.displayName}</span>! <FiSmile style={{ verticalAlign: 'middle' }} /></h1>
          <p>Chọn môn học bạn muốn ôn tập và tìm bạn học ngay</p>
        </div>

        {/* Searching Overlay */}
        {searching && (
          <div className="search-overlay animate-fade-in">
            <div className="search-modal glass-card">
              <div className="search-animation">
                <div className="search-ripple">
                  <div className="ripple-ring ripple-ring-1"></div>
                  <div className="ripple-ring ripple-ring-2"></div>
                  <div className="ripple-ring ripple-ring-3"></div>
                  <div className="search-icon-center"><FiSearch style={{ color: '#339af0' }} /></div>
                </div>
              </div>
              
              <h2>Đang tìm bạn học...</h2>
              <p className="search-subject">
                Môn: <strong>{subjects.find(s => s.id === selectedSubject)?.name}</strong>
              </p>
              <p className="search-time">{formatTime(searchTime)}</p>
              <p className="search-hint">Hệ thống đang tìm người cùng môn học với bạn</p>
              
              <button onClick={handleCancelSearch} className="btn btn-danger">
                <FiX /> Hủy tìm kiếm
              </button>
            </div>
          </div>
        )}

        {/* Subjects Grid */}
        <div className="subjects-section">
          <h2 className="subjects-title"><FiBook style={{ verticalAlign: 'middle', color: '#845ef7' }} /> Chọn Môn Học</h2>
          <div className="subjects-grid stagger-children">
            {subjects.map((subject) => (
              <button
                key={subject.id}
                className={`subject-card glass-card ${selectedSubject === subject.id ? 'selected' : ''}`}
                onClick={() => setSelectedSubject(subject.id)}
                disabled={searching}
              >
                <span className="subject-icon">{subjectIcons[subject.id] || subject.icon || <FiBook />}</span>
                <span className="subject-name">{subject.name}</span>
                <span className="subject-queue">
                  {(queueStats[subject.id] || subject.queueCount || 0) > 0 && (
                    <span className="queue-badge">
                      {queueStats[subject.id] || subject.queueCount} đang chờ
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Button */}
        <div className="search-action animate-fade-in">
          <button
            onClick={handleSearch}
            className="btn btn-primary btn-lg search-btn"
            disabled={!selectedSubject || searching}
          >
            <span><FiCrosshair style={{ color: '#fcc419' }} /></span>
            Tìm Bạn Học
          </button>
          {selectedSubject && (
            <p className="search-info">
              Bạn đã chọn: <strong>{subjects.find(s => s.id === selectedSubject)?.name}</strong>
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <div className="quick-card glass-card" onClick={() => navigate('/whiteboard')}>
            <span className="quick-icon"><FiEdit3 style={{ color: '#845ef7' }} /></span>
            <div>
              <h3>Bảng Trắng</h3>
              <p>Giải bài tập cùng nhau</p>
            </div>
          </div>
          <div className="quick-card glass-card" onClick={() => navigate('/friends')}>
            <span className="quick-icon"><FiUsers style={{ color: '#20c997' }} /></span>
            <div>
              <h3>Bạn Bè</h3>
              <p>Xem danh sách bạn bè</p>
            </div>
          </div>
          <div className="quick-card glass-card" onClick={() => navigate('/report')}>
            <span className="quick-icon"><FiAlertOctagon style={{ color: '#ff6b6b' }} /></span>
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
