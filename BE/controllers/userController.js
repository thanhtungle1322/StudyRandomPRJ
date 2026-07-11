const userService = require('../services/userService');

class UserController {
  /**
   * Fetch active students leaderboard
   */
  async getLeaderboard(req, res) {
    try {
      const { sortBy = 'totalStudyMinutes', limit = 50 } = req.query;
      const data = await userService.getLeaderboard(sortBy, limit);
      
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('[UserCtrl] Leaderboard error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }

  /**
   * Peer review rating submission
   */
  async submitReview(req, res) {
    try {
      const { roomId, revieweeId, rating, comment } = req.body;
      const reviewerId = req.user.userId;
      const result = await userService.submitReview({ reviewerId, roomId, revieweeId, rating, comment });
      
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('[UserCtrl] Review error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Log study time update
   */
  async updateStudyTime(req, res) {
    try {
      const userId = req.user.userId;
      const { roomId } = req.body;
      const data = await userService.updateStudyTime(userId, roomId);
      
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('[UserCtrl] Study time error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Get personal study statistics
   */
  async getStats(req, res) {
    try {
      const userId = req.user.userId;
      const data = await userService.getStats(userId);
      
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('[UserCtrl] Stats error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server khi lấy dữ liệu thống kê' });
    }
  }
  /**
   * Search users by displayName or email
   */
  async searchUsers(req, res) {
    try {
      const { q } = req.query;
      const currentUserId = req.user.userId;
      const users = await userService.searchUsers(q, currentUserId);

      res.json({
        success: true,
        users,
      });
    } catch (error) {
      console.error('[UserCtrl] Search error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server khi tìm kiếm' });
    }
  }
}

module.exports = new UserController();
