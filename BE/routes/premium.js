const express = require('express');
const premiumController = require('../controllers/premiumController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/premium/plans
 * Lấy danh sách các gói Premium
 */
router.get('/plans', premiumController.getPlans);

/**
 * GET /api/premium/status
 * Lấy trạng thái giới hạn ghép bạn học của user
 */
router.get('/status', authenticateToken, premiumController.getPremiumStatus);

/**
 * POST /api/premium/purchase
 * Nâng cấp lên gói Premium
 */
router.post('/purchase', authenticateToken, premiumController.purchasePremium);

/**
 * GET /api/premium/check-match-limit
 * Kiểm tra xem user có đủ điều kiện để vào hàng chờ tìm bạn học hay không
 */
router.get('/check-match-limit', authenticateToken, premiumController.checkMatchLimit);

/**
 * GET /api/premium/verify-order/:orderCode
 * Xác minh giao dịch thanh toán trực tiếp
 */
router.get('/verify-order/:orderCode', authenticateToken, premiumController.verifyOrder);

/**
 * POST /api/premium/webhook
 * Nhận thông báo thanh toán tự động từ PayOS
 */
router.post('/webhook', premiumController.handleWebhook);

module.exports = router;
