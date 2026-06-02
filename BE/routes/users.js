const express = require('express');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/users/leaderboard
 * Lấy bảng xếp hạng theo thời gian học hoặc reputation
 */
router.get('/leaderboard', userController.getLeaderboard);

/**
 * POST /api/users/review
 * Đánh giá bạn học (Reputation System)
 */
router.post('/review', authenticateToken, userController.submitReview);

/**
 * POST /api/users/study-time
 * Cập nhật thời gian học (Statistics & Gamification)
 */
router.post('/study-time', authenticateToken, userController.updateStudyTime);

/**
 * GET /api/users/stats
 * Lấy số liệu thống kê học tập cá nhân
 */
router.get('/stats', authenticateToken, userController.getStats);

/**
 * GET /api/users/search
 * Tìm kiếm người dùng bằng username hoặc displayName
 */
router.get('/search', authenticateToken, userController.searchUsers);

module.exports = router;
