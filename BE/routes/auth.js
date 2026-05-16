const express = require('express');
const User = require('../models/User');
const router = express.Router();

/**
 * POST /api/auth/login
 * Đăng nhập đơn giản - chỉ cần nhập tên
 * Lưu user vào MongoDB
 */
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Tên phải có ít nhất 2 ký tự',
      });
    }

    const trimmedName = username.trim();

    // Tìm user đã tồn tại trong DB
    let user = await User.findOne({
      username: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });

    if (user) {
      // Cập nhật trạng thái online
      user.isOnline = true;
      user.lastSeen = new Date();
      user.totalSessions += 1;
      await user.save();
    } else {
      // Tạo user mới trong DB
      user = await User.create({
        username: trimmedName,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(trimmedName)}`,
        isOnline: true,
        totalSessions: 1,
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        dbId: user._id.toString(),
        username: user.username,
        avatar: user.avatar,
        totalSessions: user.totalSessions,
        createdAt: user.createdAt,
      },
      message: `Chào mừng ${user.username}!`,
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
    });
  }
});

/**
 * GET /api/auth/user/:id
 * Lấy thông tin user từ MongoDB
 */
router.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy user',
      });
    }
    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        avatar: user.avatar,
        isOnline: user.isOnline,
        totalSessions: user.totalSessions,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth] Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
    });
  }
});

module.exports = router;
