const express = require('express');
const userController = require('../controllers/userController');
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
router.post('/review', userController.submitReview);

/**
 * POST /api/users/study-time
 * Cập nhật thời gian học (Statistics & Gamification)
 */
router.post('/study-time', userController.updateStudyTime);

module.exports = router;
