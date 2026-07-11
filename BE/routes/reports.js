const express = require('express');
const rateLimit = require('express-rate-limit');
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const reportLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 10,
	keyGenerator: (req) => req.user.userId,
	message: { success: false, message: 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.' },
	standardHeaders: true,
	legacyHeaders: false,
});

router.post('/', authenticateToken, reportLimiter, reportController.submitReport);

module.exports = router;