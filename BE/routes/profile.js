const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * PUT /api/profile
 * Cập nhật displayName và avatar
 */
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { displayName, avatar } = req.body;
    const updates = {};

    if (displayName !== undefined) {
      if (displayName.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Tên hiển thị phải có ít nhất 2 ký tự' });
      }
      if (displayName.trim().length > 30) {
        return res.status(400).json({ success: false, message: 'Tên hiển thị không được quá 30 ký tự' });
      }
      updates.displayName = displayName.trim();
    }

    if (avatar !== undefined) {
      updates.avatar = avatar;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có thông tin cần cập nhật' });
    }

    const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
      },
      message: 'Cập nhật thành công',
    });
  } catch (error) {
    console.error('[Profile] Update error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * PUT /api/profile/password
 * Đổi mật khẩu
 */
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu cũ và mới' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const user = await User.findById(req.user.userId).select('+password');
    if (!user || !user.password) {
      return res.status(400).json({ success: false, message: 'Tài khoản Google không có mật khẩu' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu cũ không đúng' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('[Profile] Password change error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
