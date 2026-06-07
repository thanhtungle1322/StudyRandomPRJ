import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  FiUsers, 
  FiMessageSquare, 
  FiGift, 
  FiTrash2, 
  FiShield, 
  FiUser, 
  FiCheckCircle, 
  FiXCircle, 
  FiStar, 
  FiPlus, 
  FiCopy, 
  FiArrowLeft,
  FiAward
} from 'react-icons/fi';
import backgroundLogin from '../../background/backgroundLogin.png';
import './AdminDashboardPage.css';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Tabs: 'users', 'feedback', 'giftcodes'
  const [activeTab, setActiveTab] = useState('users');
  
  // Data States
  const [users, setUsers] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [giftcodes, setGiftcodes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Giftcode Form States
  const [planId, setPlanId] = useState('starter');
  const [customCode, setCustomCode] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  
  // Feedback statistics
  const [feedbackStats, setFeedbackStats] = useState({ average: 0, total: 0 });

  // Status message
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Security check: Redirect if not admin
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/lobby');
    }
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const { data } = await api.get('/admin/users');
        if (data.success) setUsers(data.users);
      } else if (activeTab === 'feedback') {
        const { data } = await api.get('/admin/feedbacks');
        if (data.success) {
          setFeedbacks(data.feedbacks);
          
          // Calculate statistics
          const total = data.feedbacks.length;
          const sum = data.feedbacks.reduce((acc, f) => acc + f.rating, 0);
          const average = total > 0 ? (sum / total).toFixed(1) : 0;
          setFeedbackStats({ average, total });
        }
      } else if (activeTab === 'giftcodes') {
        const { data } = await api.get('/admin/giftcodes');
        if (data.success) setGiftcodes(data.giftcodes);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Không thể tải dữ liệu từ máy chủ.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchData();
    }
  }, [activeTab, user]);

  // User Actions
  const handleToggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'customer' : 'admin';
    if (userId === user.id) {
      setStatusMsg({ type: 'error', text: 'Bạn không thể tự hạ quyền admin của chính mình' });
      return;
    }
    
    if (!window.confirm(`Bạn có chắc chắn muốn thay đổi vai trò của người dùng này sang ${newRole.toUpperCase()}?`)) {
      return;
    }

    try {
      const { data } = await api.put(`/admin/users/${userId}/role`, { role: newRole });
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message });
        setUsers(users.map(u => u._id === userId ? { ...u, role: newRole } : u));
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Lỗi khi cập nhật vai trò' });
    }
  };

  const handleChangeUserPlan = async (userId, newTier) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}/plan`, { premiumTier: newTier });
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message });
        setUsers(users.map(u => u._id === userId ? { ...u, plan: data.user.plan, premiumTier: data.user.premiumTier } : u));
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Lỗi khi cập nhật gói người dùng' });
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (userId === user.id) {
      setStatusMsg({ type: 'error', text: 'Bạn không thể tự xóa tài khoản của chính mình' });
      return;
    }

    if (!window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN người dùng "${userName}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }

    try {
      const { data } = await api.delete(`/admin/users/${userId}`);
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message });
        setUsers(users.filter(u => u._id !== userId));
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Lỗi khi xóa người dùng' });
    }
  };

  // Giftcode Actions
  const handleGenerateGiftcode = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setStatusMsg({ type: '', text: '' });
    
    try {
      const { data } = await api.post('/admin/giftcodes', { planId, code: customCode, maxUses: Number(maxUses) });
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message });
        setCustomCode('');
        setGiftcodes([data.giftcode, ...giftcodes]);
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Lỗi khi tạo mã Giftcode' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteGiftcode = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mã Giftcode này?')) return;
    try {
      const { data } = await api.delete(`/admin/giftcodes/${id}`);
      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message });
        setGiftcodes(giftcodes.filter(g => g._id !== id));
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || 'Lỗi khi xóa mã Giftcode' });
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  // Helper formatting functions
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="admin-page" style={{ backgroundImage: `url(${backgroundLogin})` }}>
      <div className="container admin-container">
        
        {/* Navigation & Header */}
        <div className="admin-nav-header">
          <button className="admin-back-btn" onClick={() => navigate('/lobby')}>
            <FiArrowLeft /> Quay lại Sảnh chờ
          </button>
          <div className="admin-badge">
            <FiShield /> HỆ THỐNG QUẢN TRỊ VIÊN
          </div>
        </div>

        <div className="admin-header animate-fade-in">
          <h1>Bảng Điều Khiển <span className="admin-title-highlight">Admin</span></h1>
          <p className="admin-subtitle">Quản lý người dùng toàn hệ thống, tạo mã giftcode Premium và xem phản hồi trang web.</p>
        </div>

        {/* Status Message Alerts */}
        {statusMsg.text && (
          <div className={`admin-alert animate-fade-in ${statusMsg.type}`}>
            <span className="alert-text">{statusMsg.text}</span>
            <button className="alert-close" onClick={() => setStatusMsg({ type: '', text: '' })}><FiXCircle /></button>
          </div>
        )}

        {/* Tab Controls */}
        <div className="admin-tabs glass-card animate-fade-in">
          <button 
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <FiUsers /> Quản lý Người dùng
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            <FiMessageSquare /> Phản hồi Đánh giá
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'giftcodes' ? 'active' : ''}`}
            onClick={() => setActiveTab('giftcodes')}
          >
            <FiGift /> Mã Quà Tặng (Giftcode)
          </button>
        </div>

        {/* Main Content Area */}
        <div className="admin-tab-content glass-card animate-fade-in-up">
          {loading ? (
            <div className="admin-loading">
              <div className="spinner"></div>
              <p>Đang tải dữ liệu...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: USER MANAGEMENT */}
              {activeTab === 'users' && (
                <div className="admin-users-tab">
                  <div className="tab-title-row">
                    <h2>Danh sách Người dùng ({users.length})</h2>
                    <button className="btn btn-sm btn-secondary" onClick={fetchData}>Làm mới</button>
                  </div>

                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Người dùng</th>
                          <th>Email</th>
                          <th>Vai trò</th>
                          <th>Gói dịch vụ</th>
                          <th>Ngày đăng ký</th>
                          <th style={{ textAlign: 'right' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u._id}>
                            <td>
                              <div className="table-user-info">
                                <img 
                                  src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.displayName}`} 
                                  alt={u.displayName}
                                  className="table-avatar"
                                />
                                <span className="table-username">{u.displayName}</span>
                              </div>
                            </td>
                            <td><span className="table-email">{u.email}</span></td>
                            <td>
                              <span className={`role-badge ${u.role}`}>
                                {u.role === 'admin' ? 'Admin' : 'Customer'}
                              </span>
                            </td>
                            <td>
                              <select
                                className="admin-table-select"
                                value={u.premiumTier || 'none'}
                                onChange={(e) => handleChangeUserPlan(u._id, e.target.value)}
                              >
                                <option value="none">Free (Miễn phí)</option>
                                <option value="starter">Premium STARTER</option>
                                <option value="pro">Premium PRO</option>
                                <option value="ultimate">Premium ULTIMATE</option>
                              </select>
                            </td>
                            <td><span className="table-date">{formatDate(u.createdAt)}</span></td>
                            <td>
                              <div className="table-actions">
                                <button 
                                  className={`action-btn role-toggle-btn ${u._id === user.id ? 'disabled' : ''}`}
                                  onClick={() => handleToggleRole(u._id, u.role)}
                                  disabled={u._id === user.id}
                                  title="Đổi vai trò Admin/Customer"
                                >
                                  <FiShield />
                                </button>
                                <button 
                                  className={`action-btn delete-btn ${u._id === user.id ? 'disabled' : ''}`}
                                  onClick={() => handleDeleteUser(u._id, u.displayName)}
                                  disabled={u._id === user.id}
                                  title="Xóa tài khoản"
                                >
                                  <FiTrash2 />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: WEBSITE FEEDBACKS */}
              {activeTab === 'feedback' && (
                <div className="admin-feedback-tab">
                  
                  {/* Statistics widgets */}
                  <div className="feedback-stats-grid">
                    <div className="stats-card">
                      <span className="stats-icon text-gold">⭐</span>
                      <div className="stats-info">
                        <h4>Đánh giá Trung bình</h4>
                        <p className="stats-value">{feedbackStats.average} / 5.0</p>
                      </div>
                    </div>
                    <div className="stats-card">
                      <span className="stats-icon text-purple">💬</span>
                      <div className="stats-info">
                        <h4>Tổng số Phản hồi</h4>
                        <p className="stats-value">{feedbackStats.total} lượt</p>
                      </div>
                    </div>
                  </div>

                  <div className="tab-title-row">
                    <h2>Ý kiến đóng góp từ Khách hàng</h2>
                    <button className="btn btn-sm btn-secondary" onClick={fetchData}>Làm mới</button>
                  </div>

                  {feedbacks.length === 0 ? (
                    <div className="no-data-state">
                      <span>😞</span>
                      <p>Hiện chưa nhận được phản hồi đánh giá nào về trang web.</p>
                    </div>
                  ) : (
                    <div className="feedback-cards-list">
                      {feedbacks.map((f) => (
                        <div key={f._id} className="feedback-admin-card">
                          <div className="feedback-card-header">
                            <div className="feedback-sender">
                              <img 
                                src={f.userId?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.userId?.displayName || 'guest'}`} 
                                alt={f.userId?.displayName || 'Ẩn danh'} 
                                className="feedback-avatar"
                              />
                              <div>
                                <h4>{f.userId?.displayName || 'Bạn học ẩn danh'}</h4>
                                <span className="feedback-email">{f.userId?.email || 'N/A'}</span>
                              </div>
                            </div>
                            <div className="feedback-meta">
                              <div className="feedback-stars">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <FiStar 
                                    key={star} 
                                    className={`star-icon ${star <= f.rating ? 'filled' : ''}`}
                                  />
                                ))}
                              </div>
                              <span className="feedback-time">{formatDate(f.createdAt)}</span>
                            </div>
                          </div>
                          <div className="feedback-card-body">
                            <p>"{f.comment}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PREMIUM GIFTCODES */}
              {activeTab === 'giftcodes' && (
                <div className="admin-giftcodes-tab">
                  
                  {/* Create giftcode form */}
                  <div className="generate-code-card">
                    <h3><FiPlus /> Tạo Mã Giftcode Premium Mới</h3>
                    <form onSubmit={handleGenerateGiftcode} className="generate-code-form">
                      <div className="form-group">
                        <label>Chọn Gói Premium:</label>
                        <select 
                          className="admin-select"
                          value={planId}
                          onChange={(e) => setPlanId(e.target.value)}
                        >
                          <option value="starter">Starter Plan (5.000đ)</option>
                          <option value="pro">Pro Plan (10.000đ - Nổi bật)</option>
                          <option value="ultimate">Ultimate Plan (15.000đ)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Tự đặt mã code (tùy chọn):</label>
                        <input
                          type="text"
                          placeholder="Mã tự chọn (Ví dụ: FREEVIP100)"
                          className="admin-input"
                          value={customCode}
                          onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                        />
                        <span className="input-tip">Để trống để hệ thống tự động sinh mã ngẫu nhiên cực bảo mật.</span>
                      </div>

                      <div className="form-group">
                        <label>Giới hạn lượt sử dụng:</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="1"
                          className="admin-input"
                          value={maxUses}
                          onChange={(e) => setMaxUses(e.target.value)}
                        />
                        <span className="input-tip">Nhập 0 để không giới hạn số lượt. Mặc định: 1 lượt.</span>
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={generating}>
                        {generating ? 'Đang tạo...' : 'Tạo Giftcode'}
                      </button>
                    </form>
                  </div>

                  <div className="tab-title-row">
                    <h2>Mã Quà Tặng Đã Tạo ({giftcodes.length})</h2>
                    <button className="btn btn-sm btn-secondary" onClick={fetchData}>Làm mới</button>
                  </div>

                  {giftcodes.length === 0 ? (
                    <div className="no-data-state">
                      <span>🎁</span>
                      <p>Chưa có mã Giftcode nào được tạo. Hãy tạo mã đầu tiên ở trên!</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Mã Giftcode</th>
                            <th>Gói</th>
                            <th>Lượt dùng</th>
                            <th>Trạng thái</th>
                            <th>Người sử dụng gần nhất</th>
                            <th>Ngày đổi</th>
                            <th>Ngày tạo</th>
                            <th style={{ textAlign: 'right' }}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {giftcodes.map((g) => (
                            <tr key={g._id}>
                              <td>
                                <div className="code-display-wrapper">
                                  <code className="code-text">{g.code}</code>
                                  <button 
                                    className={`copy-code-btn ${copiedCode === g.code ? 'copied' : ''}`}
                                    onClick={() => handleCopyCode(g.code)}
                                    title="Copy mã code"
                                  >
                                    {copiedCode === g.code ? 'Copied!' : <FiCopy />}
                                  </button>
                                </div>
                              </td>
                              <td>
                                <span className={`giftcode-plan-badge ${g.planId}`}>
                                  {g.planId.toUpperCase()}
                                </span>
                              </td>
                              <td>
                                <span className="usage-count">
                                  {g.usedCount || 0} / {g.maxUses === 0 ? '∞' : (g.maxUses || 1)}
                                </span>
                              </td>
                              <td>
                                {g.maxUses > 0 && (g.usedCount || 0) >= g.maxUses ? (
                                  <span className="status-badge used"><FiCheckCircle /> Đã hết lượt</span>
                                ) : (
                                  <span className="status-badge unused">Còn hiệu lực</span>
                                )}
                              </td>
                              <td>
                                {g.isUsed ? (
                                  <div className="user-used-info">
                                    <span className="user-used-name">{g.usedBy?.displayName || 'Guest'}</span>
                                    <span className="user-used-email">{g.usedBy?.email}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                <span className="table-date">{g.isUsed ? formatDate(g.usedAt) : '-'}</span>
                              </td>
                              <td><span className="table-date">{formatDate(g.createdAt)}</span></td>
                              <td>
                                <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                                  <button 
                                    className="action-btn delete-btn"
                                    onClick={() => handleDeleteGiftcode(g._id)}
                                    title="Xóa mã Giftcode"
                                  >
                                    <FiTrash2 />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
