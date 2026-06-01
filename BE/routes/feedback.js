const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/feedback
 * Gửi phản hồi đánh giá trang web
 */
router.post('/', authenticateToken, feedbackController.submitFeedback);

module.exports = router;
