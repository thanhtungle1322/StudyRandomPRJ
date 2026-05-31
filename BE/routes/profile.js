const express = require('express');
const profileController = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * PUT /api/profile
 * Cập nhật displayName và avatar
 */
router.put('/', authenticateToken, profileController.updateProfile);

/**
 * PUT /api/profile/password
 * Đổi mật khẩu
 */
router.put('/password', authenticateToken, profileController.changePassword);

module.exports = router;
