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
      // Check streak
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (user.lastStudyDate) {
        const lastStudy = new Date(user.lastStudyDate);
        const lastStudyDay = new Date(lastStudy.getFullYear(), lastStudy.getMonth(), lastStudy.getDate());
        
        const diffTime = Math.abs(today - lastStudyDay);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (diffDays === 1) {
          // Studied yesterday, increment streak
          // Streak will be actually incremented after study session, but let's just keep it here if they log in. 
          // Actually better to increment streak when they complete a session. Let's just update lastSeen.
        } else if (diffDays > 1) {
          // Missed a day, reset streak
          user.streak = 0;
        }
      }

      // Cập nhật trạng thái online
      user.isOnline = true;
      user.lastSeen = now;
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
        reputation: user.reputation,
        ratingCount: user.ratingCount,
        totalStudyMinutes: user.totalStudyMinutes,
        streak: user.streak,
        badges: user.badges,
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
        reputation: user.reputation,
        ratingCount: user.ratingCount,
        totalStudyMinutes: user.totalStudyMinutes,
        streak: user.streak,
        badges: user.badges,
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
