import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FiCheckCircle, FiAlertTriangle, FiSave, FiLock, FiStar, FiArrowLeft } from 'react-icons/fi';
import { FiLoader } from 'react-icons/fi';
import './LoginPage.css';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, login } = useAuth();

  // Basic info states
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  // Personalized states
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [interests, setInterests] = useState(user?.interests?.join(', ') || '');
  const [themeColor, setThemeColor] = useState(user?.themeColor || '#7c3aed');
  const [themeGradient, setThemeGradient] = useState(user?.themeGradient || 'linear-gradient(135deg, #7c3aed, #4f46e5)');
  const [banner, setBanner] = useState(user?.banner || '');

  // Password states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Status & loading states
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Premium Cropper Modal state
  const [cropModal, setCropModal] = useState({
    isOpen: false,
    imageSrc: '',
    type: 'avatar', // 'avatar' or 'banner'
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
  });

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh đại diện không được vượt quá 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCropModal({
        isOpen: true,
        imageSrc: reader.result,
        type: 'avatar',
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset file input
  };

  const handleBannerChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh bìa không được vượt quá 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCropModal({
        isOpen: true,
        imageSrc: reader.result,
        type: 'banner',
        scale: 1.0,
        offsetX: 0,
        offsetY: 0,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset file input
  };

  const handleCropSave = () => {
    const img = new Image();
    img.src = cropModal.imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Target size
      const targetWidth = cropModal.type === 'avatar' ? 250 : 600;
      const targetHeight = cropModal.type === 'avatar' ? 250 : 200;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Fill background
      ctx.fillStyle = '#14151f';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Image original dimensions
      const iw = img.width;
      const ih = img.height;

      // Draw image using scale and offsets
      const aspect = iw / ih;
      const targetAspect = targetWidth / targetHeight;

      let drawWidth, drawHeight;
      if (aspect > targetAspect) {
        drawHeight = targetHeight * cropModal.scale;
        drawWidth = drawHeight * aspect;
      } else {
        drawWidth = targetWidth * cropModal.scale;
        drawHeight = drawWidth / aspect;
      }

      // Default centered coordinates plus slider offsets
      const x = (targetWidth - drawWidth) / 2 + cropModal.offsetX;
      const y = (targetHeight - drawHeight) / 2 + cropModal.offsetY;

      ctx.drawImage(img, x, y, drawWidth, drawHeight);

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      
      if (cropModal.type === 'avatar') {
        setAvatar(croppedBase64);
      } else {
        setBanner(croppedBase64);
      }

      setCropModal({ isOpen: false, imageSrc: '', type: 'avatar', scale: 1.0, offsetX: 0, offsetY: 0 });
    };
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || displayName.trim().length < 2) {
      setProfileMsg('Tên hiển thị phải có ít nhất 2 ký tự');
      return;
    }

    setProfileLoading(true);
    setProfileMsg('');

    try {
      const parsedInterests = interests
        .split(',')
        .map((i) => i.trim())
        .filter(Boolean);

      const { data } = await api.put('/profile', {
        displayName: displayName.trim(),
        avatar: avatar.trim(),
        nickname: nickname.trim(),
        bio: bio.trim(),
        interests: parsedInterests,
        themeColor,
        themeGradient,
        banner: banner.trim(),
      });

      if (data.success) {
        setProfileMsg('Cập nhật thành công!');
        login({
          ...user,
          displayName: data.user.displayName,
          avatar: data.user.avatar,
          nickname: data.user.nickname,
          bio: data.user.bio,
          interests: data.user.interests,
          themeColor: data.user.themeColor,
          themeGradient: data.user.themeGradient,
          banner: data.user.banner,
        }, localStorage.getItem('studyrandom_token_v2'));
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

  // Convert comma separated interests to array for real-time tag preview
  const previewInterests = interests
    .split(',')
    .map((i) => i.trim())
    .filter(Boolean);

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-orb login-orb-1"></div>
        <div className="login-orb login-orb-2"></div>
      </div>

      <div className="login-container animate-fade-in" style={{ maxWidth: 950 }}>
        <div className="login-card glass-card">
          <div className="login-header" style={{ marginBottom: '24px' }}>
            <h1>Thiết Lập Cá Nhân & Trang Trí Hồ Sơ</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Cá nhân hóa phong cách học tập và thẻ hồ sơ Discord của bạn</p>
          </div>

          <div className="profile-editor-container">
            {/* Form Section */}
            <div className="profile-form-section">
              <form onSubmit={handleUpdateProfile} className="login-form" style={{ gap: '14px' }}>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label htmlFor="displayName">Tên hiển thị *</label>
                    <input
                      id="displayName"
                      type="text"
                      className="input-field"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={30}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="nickname">Biệt danh (Nickname)</label>
                    <input
                      id="nickname"
                      type="text"
                      className="input-field"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="VD: Tuấn Học Thuật"
                      maxLength={30}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Ảnh đại diện (Từ thiết bị)</label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleAvatarChange}
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="btn btn-secondary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        height: '40px',
                        cursor: 'pointer',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px dashed rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontWeight: '500',
                        fontSize: '13px',
                        margin: 0
                      }}
                    >
                      📁 Chọn ảnh từ thiết bị
                    </label>
                  </div>

                  <div className="input-group">
                    <label>Ảnh bìa Banner (Từ thiết bị)</label>
                    <input
                      id="banner-upload"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleBannerChange}
                    />
                    <label
                      htmlFor="banner-upload"
                      className="btn btn-secondary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        height: '40px',
                        cursor: 'pointer',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px dashed rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontWeight: '500',
                        fontSize: '13px',
                        margin: 0
                      }}
                    >
                      🖼️ Chọn ảnh bìa từ thiết bị
                    </label>
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="bio">Giới thiệu bản thân (Bio)</label>
                  <textarea
                    id="bio"
                    className="input-field"
                    style={{ height: '70px', resize: 'none', padding: '10px 14px' }}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Viết mô tả ngắn về bạn..."
                    maxLength={200}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="interests">Sở thích học tập (ngăn cách bằng dấu phẩy)</label>
                  <input
                    id="interests"
                    type="text"
                    className="input-field"
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    placeholder="VD: Toán học, NodeJS, Nhạc Lofi, Chạy bộ"
                  />
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Màu chủ đạo Theme (Hex)</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        style={{ width: '45px', height: '40px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                        value={themeColor.startsWith('#') ? themeColor : '#7c3aed'}
                        onChange={(e) => {
                          setThemeColor(e.target.value);
                          setThemeGradient(e.target.value);
                        }}
                      />
                      <input
                        type="text"
                        className="input-field"
                        style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                        value={themeColor}
                        onChange={(e) => {
                          setThemeColor(e.target.value);
                          setThemeGradient(e.target.value);
                        }}
                        maxLength={7}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Preset Gradient Theme</label>
                    <select
                      className="input-field"
                      style={{ height: '40px' }}
                      value={themeGradient}
                      onChange={(e) => {
                        setThemeGradient(e.target.value);
                        if (e.target.value.startsWith('#')) {
                          setThemeColor(e.target.value);
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

                {profileMsg && (
                  <div className={`login-error`}
                    style={profileMsg.includes('thành công') ? { background: 'rgba(81,207,102,0.1)', color: 'var(--success)' } : {}}>
                    <span>{profileMsg.includes('thành công') ? <FiCheckCircle /> : <FiAlertTriangle />}</span> {profileMsg}
                  </div>
                )}

                <button type="submit" className="btn btn-primary login-btn" disabled={profileLoading} style={{ marginTop: '8px' }}>
                  {profileLoading ? <><FiLoader className="spin-icon animate-spin" /> Đang lưu...</> : <><FiSave /> Lưu cấu hình</>}
                </button>
              </form>
            </div>

            {/* Premium Preview Section */}
            <div className="profile-preview-section">
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#8e9297', letterSpacing: '0.5px', marginBottom: '8px' }}>Xem trước Live Preview</span>

              <div className="live-preview-card animate-fade-in">
                {/* Live Banner */}
                <div
                  className="live-preview-banner"
                  style={{
                    backgroundImage: banner ? `url(${banner})` : 'none',
                    background: !banner ? themeGradient : undefined
                  }}
                >
                  <div className="live-preview-avatar">
                    <img
                      src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`}
                      alt="Avatar"
                      onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`; }}
                    />
                  </div>
                </div>

                {/* Live Body */}
                <div className="live-preview-body">
                  <div className="live-preview-displayname">
                    <span>{displayName || 'Họ tên'}</span>
                    {nickname && (
                      <span className="live-preview-nickname">"{nickname}"</span>
                    )}
                  </div>
                  <div className="live-preview-email">@{user?.email?.split('@')[0]}</div>

                  <div className="live-preview-badge-row">
                    <span className="live-preview-badge" style={{ background: 'rgba(252, 196, 25, 0.15)', borderColor: '#fcc419', color: '#fcc419' }}>Premium ⭐</span>
                    <span className="live-preview-badge">CHĂM CHỈ 🔥</span>
                    <span className="live-preview-badge" style={{ background: 'rgba(81, 207, 102, 0.15)', borderColor: '#51cf66', color: '#51cf66' }}>MỘC SÁCH 📚</span>
                  </div>

                  <div className="live-preview-divider"></div>

                  <div className="discord-section-title" style={{ fontSize: '10px' }}>Giới thiệu</div>
                  <div className="live-preview-bio">
                    {bio || 'Chưa viết giới thiệu.'}
                  </div>

                  <div className="live-preview-divider"></div>

                  <div className="discord-section-title" style={{ fontSize: '10px' }}>Sở thích học tập</div>
                  <div className="live-preview-interests">
                    {previewInterests.length > 0 ? (
                      previewInterests.map((interest, idx) => (
                        <span key={idx} className="live-preview-tag">✨ {interest}</span>
                      ))
                    ) : (
                      <span style={{ fontSize: '11px', fontStyle: 'italic', opacity: 0.6 }}>Chưa có sở thích.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          {user?.authProvider !== 'google' && (
            <>
              <hr style={{ borderColor: 'var(--border-color)', margin: '32px 0 24px 0' }} />
              <h3 style={{ marginBottom: 16, fontSize: 16 }}>🔑 Bảo mật & Đổi mật khẩu</h3>
              <form onSubmit={handleChangePassword} className="login-form">
                <div className="form-grid-2">
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
                </div>

                {passwordMsg && (
                  <div className={`login-error`}
                    style={passwordMsg.includes('thành công') ? { background: 'rgba(81,207,102,0.1)', color: 'var(--success)' } : {}}>
                    <span>{passwordMsg.includes('thành công') ? <FiCheckCircle /> : <FiAlertTriangle />}</span> {passwordMsg}
                  </div>
                )}

                <button type="submit" className="btn btn-secondary login-btn" disabled={passwordLoading}>
                  {passwordLoading ? <><FiLoader className="spin-icon animate-spin" /> Đang đổi...</> : <><FiLock /> Đổi mật khẩu</>}
                </button>
              </form>
            </>
          )}

      {/* Premium Image Cropper Modal */}
      {cropModal.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 5, 8, 0.85)',
          backdropFilter: 'blur(16px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            background: '#0f111a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 32px rgba(132, 94, 247, 0.15)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            fontFamily: "'Inter', sans-serif"
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#845ef7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Định dạng {cropModal.type === 'avatar' ? 'Ảnh đại diện' : 'Ảnh bìa'}
              </h3>
              <button 
                type="button"
                onClick={() => setCropModal({ isOpen: false, imageSrc: '', type: 'avatar', scale: 1.0, offsetX: 0, offsetY: 0 })}
                style={{ background: 'transparent', border: 'none', color: '#adb5bd', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#adb5bd', lineHeight: '1.5' }}>
              Sử dụng các thanh trượt bên dưới để Phóng to/Thu nhỏ và di chuyển bức ảnh vào vùng an toàn theo ý muốn.
            </p>

            {/* Cropping Viewport Container */}
            <div style={{
              width: '100%',
              height: '240px',
              background: '#07080d',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {/* Preview Bounding Mask Overlay */}
              <div style={{
                position: 'absolute',
                zIndex: 10,
                boxShadow: '0 0 0 9999px rgba(7, 8, 13, 0.75)',
                border: '2px solid #845ef7',
                pointerEvents: 'none',
                width: cropModal.type === 'avatar' ? '160px' : '300px',
                height: cropModal.type === 'avatar' ? '160px' : '100px',
                borderRadius: cropModal.type === 'avatar' ? '50%' : '8px',
              }} />

              {/* The Interactive Image Preview */}
              <img 
                src={cropModal.imageSrc}
                alt="Crop preview"
                style={{
                  maxWidth: 'none',
                  position: 'absolute',
                  transform: `translate(${cropModal.offsetX}px, ${cropModal.offsetY}px) scale(${cropModal.scale})`,
                  transition: 'transform 0.05s ease',
                  height: cropModal.type === 'avatar' ? '160px' : '100px',
                  objectFit: 'contain'
                }}
              />
            </div>

            {/* Control Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Zoom Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#adb5bd' }}>
                  <span>Kích thước (Zoom)</span>
                  <span style={{ color: '#845ef7', fontWeight: '600' }}>{Math.round(cropModal.scale * 100)}%</span>
                </div>
                <input 
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={cropModal.scale}
                  onChange={(e) => setCropModal({ ...cropModal, scale: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    accentColor: '#845ef7',
                    background: 'rgba(255,255,255,0.1)',
                    height: '6px',
                    borderRadius: '3px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {/* Horizontal Offset Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#adb5bd' }}>
                  <span>Di chuyển ngang (Trái / Phải)</span>
                  <span>{cropModal.offsetX}px</span>
                </div>
                <input 
                  type="range"
                  min="-250"
                  max="250"
                  step="1"
                  value={cropModal.offsetX}
                  onChange={(e) => setCropModal({ ...cropModal, offsetX: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    accentColor: '#845ef7',
                    background: 'rgba(255,255,255,0.1)',
                    height: '6px',
                    borderRadius: '3px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {/* Vertical Offset Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#adb5bd' }}>
                  <span>Di chuyển dọc (Lên / Xuống)</span>
                  <span>{cropModal.offsetY}px</span>
                </div>
                <input 
                  type="range"
                  min="-200"
                  max="200"
                  step="1"
                  value={cropModal.offsetY}
                  onChange={(e) => setCropModal({ ...cropModal, offsetY: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    accentColor: '#845ef7',
                    background: 'rgba(255,255,255,0.1)',
                    height: '6px',
                    borderRadius: '3px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button"
                onClick={() => setCropModal({ isOpen: false, imageSrc: '', type: 'avatar', scale: 1.0, offsetX: 0, offsetY: 0 })}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Hủy
              </button>
              <button 
                type="button"
                onClick={handleCropSave}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #845ef7, #5c7cfa)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(132, 94, 247, 0.3)',
                  transition: 'transform 0.2s'
                }}
              >
                ✓ Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

          <div className="login-footer" style={{ marginTop: 32 }}>
            <Link to="/lobby"><FiArrowLeft /> Quay lại Sảnh chờ</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
