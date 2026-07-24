const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/auth/register
 * Đăng ký tài khoản mới với email + password + displayName
 * @returns {201} User registered successfully
 * @returns {400} Bad Request - Invalid input or email already exists
 * @returns {500} Server Error
 */
router.post('/register', authController.register);

/**
 * POST /api/auth/login
 * Đăng nhập với email + password
 * @returns {200} Login successful
 * @returns {400} Bad Request - Invalid credentials
 * @returns {500} Server Error
 */
router.post('/login', authController.login);

/**
 * GET /api/auth/google
 * Khởi tạo Google OAuth flow
 * @returns {302} Redirect to Google OAuth
 * @returns {500} Server Error
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false, // Dùng JWT stateless, không cần session
  prompt: 'select_account',
}));

/**
 * GET /api/auth/google/callback
 * Google OAuth callback → redirect về frontend với token
 * @returns {302} Redirect to frontend with token
 * @returns {400} Bad Request - OAuth failed
 * @returns {500} Server Error
 */
router.get('/google/callback', authController.googleCallback);

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại
 * @returns {200} User information retrieved
 * @returns {401} Unauthorized - Invalid or missing token
 * @returns {500} Server Error
 */
router.get('/me', authenticateToken, authController.getMe);

/**
 * POST /api/auth/logout
 * Đăng xuất
 * @returns {200} Logout successful
 * @returns {401} Unauthorized - Invalid or missing token
 * @returns {500} Server Error
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * GET /api/auth/user/:id
 * Lấy thông tin user (public)
 * @returns {200} User profile retrieved
 * @returns {404} Not Found - User does not exist
 * @returns {500} Server Error
 */
router.get('/user/:id', authController.getPublicProfile);

module.exports = router;