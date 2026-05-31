const express = require('express');
const friendController = require('../controllers/friendController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/friends/request
 * Gửi lời mời kết bạn
 */
router.post('/request', authenticateToken, friendController.sendFriendRequest);

/**
 * PUT /api/friends/respond
 * Chấp nhận hoặc từ chối lời mời kết bạn
 */
router.put('/respond', authenticateToken, friendController.respondToFriendRequest);

/**
 * GET /api/friends
 * Lấy danh sách bạn bè (chỉ accepted)
 */
router.get('/', authenticateToken, friendController.getFriendsList);

/**
 * GET /api/friends/pending
 * Lấy danh sách lời mời kết bạn đang chờ (mình là recipient)
 */
router.get('/pending', authenticateToken, friendController.getPendingRequests);

/**
 * GET /api/friends/status/:userId
 * Kiểm tra trạng thái kết bạn với một user cụ thể
 */
router.get('/status/:userId', authenticateToken, friendController.checkFriendshipStatus);

/**
 * DELETE /api/friends/:friendshipId
 * Hủy kết bạn hoặc hủy lời mời đã gửi
 */
router.delete('/:friendshipId', authenticateToken, friendController.deleteFriendship);

module.exports = router;
