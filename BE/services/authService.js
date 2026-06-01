const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const UserDto = require('../dtos/userDto');

class AuthService {
  /**
   * Register a new user
   */
  async register({ email, password, displayName }) {
    if (!displayName || displayName.trim().length < 2) {
      throw { status: 400, message: 'Tên hiển thị phải có ít nhất 2 ký tự' };
    }
    if (!email || !email.includes('@')) {
      throw { status: 400, message: 'Email không hợp lệ' };
    }
    if (!password || password.length < 6) {
      throw { status: 400, message: 'Mật khẩu phải có ít nhất 6 ký tự' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw { status: 409, message: 'Email đã được đăng ký' };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      displayName: displayName.trim(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName.trim())}`,
      authProvider: 'local',
      isOnline: true,
    });

    const token = this.generateToken(user);

    return {
      token,
      user: UserDto.toSelf(user),
      message: `Chào mừng ${user.displayName}!`,
    };
  }

  /**
   * Login with email and password
   */
  async login({ email, password }) {
    if (!email || !password) {
      throw { status: 400, message: 'Vui lòng nhập email và mật khẩu' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      throw { status: 401, message: 'Email hoặc mật khẩu không đúng' };
    }

    if (user.authProvider === 'google' && !user.password) {
      throw { status: 401, message: 'Tài khoản này đăng nhập bằng Google. Vui lòng sử dụng nút Đăng nhập với Google.' };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw { status: 401, message: 'Email hoặc mật khẩu không đúng' };
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    user.totalSessions += 1;
    await user.save();

    const token = this.generateToken(user);

    return {
      token,
      user: UserDto.toSelf(user),
      message: `Chào mừng ${user.displayName}!`,
    };
  }

  /**
   * Get current user details
   */
  async getMe(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }
    return UserDto.toSelf(user);
  }

  /**
   * Logout user
   */
  async logout(userId) {
    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date(),
    });
    return { success: true, message: 'Đã đăng xuất' };
  }

  /**
   * Get public profile of another user
   */
  async getPublicProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }
    return UserDto.toPublic(user);
  }

  /**
   * Helper to sign JWT tokens
   */
  generateToken(user) {
    const tokenPayload = {
      userId: user._id.toString(),
      displayName: user.displayName,
      email: user.email,
    };
    return jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '7d' });
  }
}

module.exports = new AuthService();
