const profileService = require('../services/profileService');

class ProfileController {
  /**
   * Update user profile displayName and/or avatar and other Discord-like personalization details
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.userId;
      const { displayName, avatar, nickname, bio, interests, themeColor, themeGradient, banner, badges } = req.body;
      const updatedUser = await profileService.updateProfile(userId, { displayName, avatar, nickname, bio, interests, themeColor, themeGradient, banner, badges });
      
      res.json({
        success: true,
        user: updatedUser,
        message: 'Cập nhật thành công',
      });
    } catch (error) {
      console.error('[ProfileCtrl] Update error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Fetch a user profile by their ID (for Discord-like popup)
   */
  async getProfile(req, res) {
    try {
      const { userId } = req.params;
      const data = await profileService.getProfile(userId);
      
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('[ProfileCtrl] GetProfile error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }

  /**
   * Change current user password
   */
  async changePassword(req, res) {
    try {
      const userId = req.user.userId;
      const { oldPassword, newPassword } = req.body;
      const result = await profileService.changePassword(userId, { oldPassword, newPassword });
      
      res.json(result);
    } catch (error) {
      console.error('[ProfileCtrl] Password change error:', error);
      const status = error.status || 500;
      res.status(status).json({ success: false, message: error.message || 'Lỗi server' });
    }
  }
}

module.exports = new ProfileController();
