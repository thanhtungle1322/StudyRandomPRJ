const bcrypt = require('bcryptjs');
const User = require('../models/User');

class ProfileService {
  /**
   * Update profile display name and/or avatar
   */
  /**
   * Update profile display name, avatar, and Discord-like decoration details
   */
  async updateProfile(userId, { displayName, avatar, nickname, bio, interests, themeColor, themeGradient, banner, badges }) {
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

    if (nickname !== undefined) {
      if (nickname.trim().length > 30) {
        throw { status: 400, message: 'Biệt danh không được quá 30 ký tự' };
      }
      updates.nickname = nickname.trim();
    }

    if (bio !== undefined) {
      if (bio.trim().length > 200) {
        throw { status: 400, message: 'Mô tả bản thân không được quá 200 ký tự' };
      }
      updates.bio = bio.trim();
    }

    if (interests !== undefined) {
      if (!Array.isArray(interests)) {
        throw { status: 400, message: 'Sở thích phải là một mảng' };
      }
      updates.interests = interests.map(i => i.trim()).filter(Boolean);
    }

    if (themeColor !== undefined) {
      updates.themeColor = themeColor;
    }

    if (themeGradient !== undefined) {
      updates.themeGradient = themeGradient;
    }

    if (banner !== undefined) {
      updates.banner = banner;
    }

    if (badges !== undefined) {
      if (!Array.isArray(badges)) {
        throw { status: 400, message: 'Danh hiệu phải là một mảng' };
      }
      updates.badges = badges;
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
      nickname: user.nickname || '',
      bio: user.bio || '',
      interests: user.interests || [],
      themeColor: user.themeColor || '#7c3aed',
      themeGradient: user.themeGradient || 'linear-gradient(135deg, #7c3aed, #4f46e5)',
      banner: user.banner || '',
      badges: user.badges || [],
      reputation: user.reputation,
      ratingCount: user.ratingCount,
      totalSessions: user.totalSessions,
      totalStudyMinutes: user.totalStudyMinutes,
      streak: user.streak,
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

  /**
   * Get user profile details by ID along with their reviews
   */
  async getProfile(userId) {
    const User = require('../models/User');
    const Review = require('../models/Review');

    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    // Lấy các đánh giá gần nhất của user này
    const reviews = await Review.find({ revieweeId: userId })
      .populate('reviewerId', 'displayName avatar')
      .sort({ createdAt: -1 })
      .limit(10); // Lấy tối đa 10 đánh giá gần đây nhất

    return {
      user: {
        id: user._id.toString(),
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        plan: user.plan,
        nickname: user.nickname || '',
        bio: user.bio || '',
        interests: user.interests || [],
        themeColor: user.themeColor || '#7c3aed',
        themeGradient: user.themeGradient || 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        banner: user.banner || '',
        badges: user.badges || [],
        reputation: user.reputation,
        ratingCount: user.ratingCount,
        totalSessions: user.totalSessions,
        totalStudyMinutes: user.totalStudyMinutes,
        streak: user.streak,
      },
      reviews: reviews.map(r => ({
        id: r._id.toString(),
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: r.reviewerId ? {
          displayName: r.reviewerId.displayName,
          avatar: r.reviewerId.avatar
        } : { displayName: 'Người dùng ẩn danh', avatar: '' }
      }))
    };
  }
}

module.exports = new ProfileService();
