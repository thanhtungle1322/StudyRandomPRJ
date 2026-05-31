const friendService = require('../services/friendService');

class FriendController {
  /**
   * Send a friend request to another user
   */
  async sendFriendRequest(req, res) {
    try {
      const requesterId = req.user.userId;
      const { recipientId } = req.body;
      
      const friendship = await friendService.sendFriendRequest(requesterId, recipientId);
      
      res.status(201).json({
        success: true,
        friendship,
        message: 'Đã gửi lời mời kết bạn',
      });
    } catch (error) {
      console.error('[FriendCtrl] Send request error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Accept or reject a pending friend request
   */
  async respondToFriendRequest(req, res) {
    try {
      const userId = req.user.userId;
      const { friendshipId, action } = req.body;
      
      const friendship = await friendService.respondToFriendRequest(userId, friendshipId, action);
      const message = action === 'accept' ? 'Đã chấp nhận lời mời kết bạn' : 'Đã từ chối lời mời kết bạn';
      
      res.json({
        success: true,
        friendship,
        message,
      });
    } catch (error) {
      console.error('[FriendCtrl] Respond error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Retrieve the authenticated user's friend list
   */
  async getFriendsList(req, res) {
    try {
      const userId = req.user.userId;
      const friends = await friendService.getFriendsList(userId);
      
      res.json({
        success: true,
        friends,
      });
    } catch (error) {
      console.error('[FriendCtrl] Get list error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Retrieve the list of pending friend invitations for the authenticated user
   */
  async getPendingRequests(req, res) {
    try {
      const userId = req.user.userId;
      const requests = await friendService.getPendingRequests(userId);
      
      res.json({
        success: true,
        requests,
      });
    } catch (error) {
      console.error('[FriendCtrl] Get pending error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Check status of friendship with another user
   */
  async checkFriendshipStatus(req, res) {
    try {
      const currentUserId = req.user.userId;
      const targetUserId = req.params.userId;
      
      const result = await friendService.checkFriendshipStatus(currentUserId, targetUserId);
      
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('[FriendCtrl] Check status error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Remove friend or cancel request
   */
  async deleteFriendship(req, res) {
    try {
      const userId = req.user.userId;
      const { friendshipId } = req.params;
      
      const result = await friendService.deleteFriendship(userId, friendshipId);
      
      res.json(result);
    } catch (error) {
      console.error('[FriendCtrl] Delete error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
}

module.exports = new FriendController();
