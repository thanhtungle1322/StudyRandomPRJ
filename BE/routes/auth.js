const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/auth/register
 * Đăng ký tài khoản mới với email + password + displayName
 */
router.post('/register', authController.register);

/**
 * POST /api/auth/login
 * Đăng nhập với email + password
 */
router.post('/login', authController.login);

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
router.get('/google/callback', authController.googleCallback);

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại
 */
router.get('/me', authenticateToken, authController.getMe);

/**
 * POST /api/auth/logout
 * Đăng xuất
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * GET /api/auth/user/:id
 * Lấy thông tin user (public)
 */
router.get('/user/:id', authController.getPublicProfile);

module.exports = router;
