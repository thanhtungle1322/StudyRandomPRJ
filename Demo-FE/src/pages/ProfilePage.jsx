import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FiCheckCircle, FiAlertTriangle, FiSave, FiLock, FiStar, FiArrowLeft } from 'react-icons/fi';
import './LoginPage.css';

export default function ProfilePage() {
  const { user, login } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || displayName.trim().length < 2) {
      setProfileMsg('Tên hiển thị phải có ít nhất 2 ký tự');
      return;
    }

    setProfileLoading(true);
    setProfileMsg('');

    try {
      const { data } = await api.put('/profile', { displayName: displayName.trim() });
      if (data.success) {
        setProfileMsg('Cập nhật thành công!');
        login({ ...user, displayName: data.user.displayName }, localStorage.getItem('studyrandom_token_v2'));
      }
    } catch (err) {
      setProfileMsg(err.response?.data?.message || 'Lỗi cập nhật');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      setPasswordMsg('Vui lòng nhập đầy đủ mật khẩu');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setPasswordLoading(true);
    setPasswordMsg('');

    try {
      const { data } = await api.put('/profile/password', { oldPassword, newPassword });
      if (data.success) {
        setPasswordMsg('Đổi mật khẩu thành công!');
        setOldPassword('');
        setNewPassword('');
      }
    } catch (err) {
      setPasswordMsg(err.response?.data?.message || 'Lỗi đổi mật khẩu');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
      </div>

      <div className="login-container animate-fade-in" style={{ maxWidth: 520 }}>
        <div className="login-card glass-card">
          <div className="login-header">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName}`}
              alt="Avatar"
              style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 16 }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <h1>Hồ Sơ Cá Nhân</h1>
            <p style={{ color: 'var(--text-secondary)' }}>{user?.email}</p>
            {user?.plan === 'premium' && (
              <span style={{ color: '#fcc419', fontWeight: 600, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <FiStar /> Premium
              </span>
            )}
          </div>

          <form onSubmit={handleUpdateProfile} className="login-form">
            <div className="input-group">
              <label htmlFor="displayName">Tên hiển thị</label>
              <input
                id="displayName"
                type="text"
                className="input-field"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
              />
            </div>

            {profileMsg && (
              <div className={`login-error`}
                   style={profileMsg.includes('thành công') ? { background: 'rgba(81,207,102,0.1)', color: 'var(--success)' } : {}}>
                <span>{profileMsg.includes('thành công') ? <FiCheckCircle /> : <FiAlertTriangle />}</span> {profileMsg}
              </div>
            )}

            <button type="submit" className="btn btn-primary login-btn" disabled={profileLoading}>
              {profileLoading ? <><span className="spinner"></span> Đang lưu...</> : <><FiSave /> Lưu thay đổi</>}
            </button>
          </form>

          {user?.authProvider !== 'google' && (
            <>
              <hr style={{ borderColor: 'var(--border-color)', margin: '24px 0' }} />
              <h3 style={{ marginBottom: 16, fontSize: 16 }}>Đổi mật khẩu</h3>
              <form onSubmit={handleChangePassword} className="login-form">
                <div className="input-group">
                  <label htmlFor="oldPassword">Mật khẩu cũ</label>
                  <input
                    id="oldPassword"
                    type="password"
                    className="input-field"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="newPassword">Mật khẩu mới</label>
                  <input
                    id="newPassword"
                    type="password"
                    className="input-field"
                    placeholder="Ít nhất 6 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                {passwordMsg && (
                  <div className={`login-error`}
                       style={passwordMsg.includes('thành công') ? { background: 'rgba(81,207,102,0.1)', color: 'var(--success)' } : {}}>
                    <span>{passwordMsg.includes('thành công') ? <FiCheckCircle /> : <FiAlertTriangle />}</span> {passwordMsg}
                  </div>
                )}

                <button type="submit" className="btn btn-secondary login-btn" disabled={passwordLoading}>
                  {passwordLoading ? <><span className="spinner"></span> Đang đổi...</> : <><FiLock /> Đổi mật khẩu</>}
                </button>
              </form>
            </>
          )}

          <div className="login-footer" style={{ marginTop: 24 }}>
            <Link to="/lobby"><FiArrowLeft /> Quay lại Sảnh chờ</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
