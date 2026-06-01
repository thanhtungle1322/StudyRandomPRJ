const userService = require('../services/userService');

class UserController {
  /**
   * Fetch active students leaderboard
   */
  async getLeaderboard(req, res) {
    try {
      const { sortBy = 'totalStudyMinutes', limit = 10 } = req.query;
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
      const { reviewerId, revieweeId, sessionId, rating, comment } = req.body;
      const result = await userService.submitReview({ reviewerId, revieweeId, sessionId, rating, comment });
      
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
      const { userId, minutes } = req.body;
      const data = await userService.updateStudyTime(userId, minutes);
      
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
   * Search users matching search query
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
      console.error('[UserCtrl] Search users error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server khi tìm kiếm' });
    }
  }
}

module.exports = new UserController();
