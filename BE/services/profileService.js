const bcrypt = require('bcryptjs');
const User = require('../models/User');

class ProfileService {
  /**
   * Update profile display name and/or avatar
   */
  async updateProfile(userId, { displayName, avatar }) {
    const updates = {};

    if (displayName !== undefined) {
      if (displayName.trim().length < 2) {
        throw { status: 400, message: 'Tên hiển thị phải có ít nhất 2 ký tự' };
      }
      if (displayName.trim().length > 30) {
        throw { status: 400, message: 'Tên hiển thị không được quá 30 ký tự' };
      }
      updates.displayName = displayName.trim();
    }

    if (avatar !== undefined) {
      updates.avatar = avatar;
    }

    if (Object.keys(updates).length === 0) {
      throw { status: 400, message: 'Không có thông tin cần cập nhật' };
    }

    const user = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }

    return {
      id: user._id.toString(),
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar,
      plan: user.plan,
    };
  }

  /**
   * Update user password
   */
  async changePassword(userId, { oldPassword, newPassword }) {
    if (!oldPassword || !newPassword) {
      throw { status: 400, message: 'Vui lòng nhập mật khẩu cũ và mới' };
    }
    if (newPassword.length < 6) {
      throw { status: 400, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' };
    }

    const user = await User.findById(userId).select('+password');
    if (!user || !user.password) {
      throw { status: 400, message: 'Tài khoản Google không có mật khẩu' };
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw { status: 400, message: 'Mật khẩu cũ không đúng' };
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return { success: true, message: 'Đổi mật khẩu thành công' };
  }
}

module.exports = new ProfileService();
