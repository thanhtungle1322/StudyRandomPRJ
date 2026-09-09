const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
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
router.get('/google', (req, res, next) => {
  const isFetch = req.xhr || req.headers.accept?.includes('application/json') || req.headers['sec-fetch-mode'] === 'cors' || req.query.json === 'true' || req.headers['origin'];

  if (isFetch) {
    const originalEnd = res.end.bind(res);
    res.end = function(chunk, encoding) {
      const location = res.getHeader('Location') || res.getHeader('location');
      if (location && typeof location === 'string') {
        res.statusCode = 200;
        res.removeHeader('Location');
        res.setHeader('Content-Type', 'application/json');
        const jsonBody = JSON.stringify({
          success: true,
          url: location,
          message: 'Google OAuth Redirect URL',
        });
        res.setHeader('Content-Length', Buffer.byteLength(jsonBody));
        return originalEnd(jsonBody, 'utf8');
      }
      return originalEnd(chunk, encoding);
    };
  }

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    prompt: 'select_account',
  })(req, res, next);
});

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
router.post('/logout', optionalAuth, authController.logout);

/**
 * GET /api/auth/user/:id
 * Lấy thông tin user (public)
 */
router.get('/user/:id', authController.getPublicProfile);

module.exports = router;
