const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Apply auth & admin middlewares globally for all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * Lấy danh sách tất cả người dùng
 */
router.get('/users', adminController.getUsers);

/**
 * PUT /api/admin/users/:id/role
 * Cập nhật vai trò (role) của người dùng
 */
router.put('/users/:id/role', adminController.updateUserRole);

/**
 * PUT /api/admin/users/:id/plan
 * Cập nhật gói dịch vụ (plan) của người dùng
 */
router.put('/users/:id/plan', adminController.updateUserPlan);

/**
 * DELETE /api/admin/users/:id
 * Xóa người dùng khỏi hệ thống
 */
router.delete('/users/:id', adminController.deleteUser);

/**
 * GET /api/admin/feedbacks
 * Lấy danh sách phản hồi/đánh giá trang web
 */
router.get('/feedbacks', adminController.getFeedbacks);

/**
 * GET /api/admin/giftcodes
 * Lấy danh sách tất cả giftcode đã tạo
 */
router.get('/giftcodes', adminController.getGiftcodes);

/**
 * POST /api/admin/giftcodes
 * Tạo mã giftcode Premium mới
 */
router.post('/giftcodes', adminController.generateGiftcode);

/**
 * DELETE /api/admin/giftcodes/:id
 * Xóa giftcode
 */
router.delete('/giftcodes/:id', adminController.deleteGiftcode);

module.exports = router;
