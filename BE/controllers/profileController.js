const profileService = require('../services/profileService');

class ProfileController {
  /**
   * Update user profile displayName and/or avatar
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.userId;
      const { displayName, avatar } = req.body;
      const updatedUser = await profileService.updateProfile(userId, { displayName, avatar });
      
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
