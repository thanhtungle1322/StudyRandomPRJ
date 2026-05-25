const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const User = require('../models/User');
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/auth/register
 * Đăng ký tài khoản mới với email + password + displayName
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!displayName || displayName.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Tên hiển thị phải có ít nhất 2 ký tự' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email đã được đăng ký' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      displayName: displayName.trim(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName.trim())}`,
      authProvider: 'local',
      isOnline: true,
    });

    const tokenPayload = {
      userId: user._id.toString(),
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        authProvider: user.authProvider,
        createdAt: user.createdAt,
      },
      message: `Chào mừng ${user.displayName}!`,
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * POST /api/auth/login
 * Đăng nhập với email + password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    }

    if (user.authProvider === 'google' && !user.password) {
      return res.status(401).json({ success: false, message: 'Tài khoản này đăng nhập bằng Google. Vui lòng sử dụng nút Đăng nhập với Google.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    user.totalSessions += 1;
    await user.save();

    const tokenPayload = {
      userId: user._id.toString(),
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        authProvider: user.authProvider,
        totalSessions: user.totalSessions,
        createdAt: user.createdAt,
      },
      message: `Chào mừng ${user.displayName}!`,
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * GET /api/auth/google
 * Khởi tạo Google OAuth flow
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: true,
}));

/**
 * GET /api/auth/google/callback
 * Google OAuth callback → redirect về frontend với token
 */
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    const clientUrl = config.clientUrl.split(',')[0].trim();

    if (err) {
      console.error('[Auth] Google callback - Passport error:', err.message);
      console.error('[Auth] Google callback - Error details:', err);
      return res.redirect(`${clientUrl}/login?error=google_auth_failed&reason=passport_error`);
    }

    if (!user) {
      console.error('[Auth] Google callback - No user returned. Info:', info);
      return res.redirect(`${clientUrl}/login?error=google_auth_failed&reason=no_user`);
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('[Auth] Google callback - req.logIn error:', loginErr.message);
        return res.redirect(`${clientUrl}/login?error=google_auth_failed&reason=login_error`);
      }

      console.log('[Auth] Google callback - Success! User:', user._id, user.displayName);

      const tokenPayload = {
        userId: user._id.toString(),
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
      };

      const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '7d' });
      res.redirect(`${clientUrl}/auth/callback?token=${token}`);
    });
  })(req, res, next);
});

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
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
        isOnline: user.isOnline,
        plan: user.plan,
        authProvider: user.authProvider,
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
    console.error('[Auth] Get me error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * POST /api/auth/logout
 * Đăng xuất
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, {
      isOnline: false,
      lastSeen: new Date(),
    });
    res.json({ success: true, message: 'Đã đăng xuất' });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

/**
 * GET /api/auth/user/:id
 * Lấy thông tin user (public)
 */
router.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }
    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        displayName: user.displayName,
        avatar: user.avatar,
        isOnline: user.isOnline,
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
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
