const User = require('../models/User');
const Feedback = require('../models/Feedback');
const Giftcode = require('../models/Giftcode');
const Setting = require('../models/Setting');

class AdminController {
  /**
   * Get all users in the system
   */
  async getUsers(req, res) {
    try {
      const users = await User.find().sort({ createdAt: -1 });
      res.json({
        success: true,
        users,
      });
    } catch (error) {
      console.error('[AdminCtrl] Get users error:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách người dùng' });
    }
  }

  /**
   * Update a user's role
   */
  async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!['customer', 'admin'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
      }

      if (id === req.user.userId && role !== 'admin') {
        return res.status(400).json({ success: false, message: 'Bạn không thể tự hạ quyền admin của chính mình' });
      }

      const user = await User.findByIdAndUpdate(id, { role }, { new: true });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      }

      res.json({
        success: true,
        message: `Đã cập nhật vai trò của ${user.displayName} thành ${role === 'admin' ? 'Quản trị viên (Admin)' : 'Khách hàng (Customer)'}`,
        user,
      });
    } catch (error) {
      console.error('[AdminCtrl] Update user role error:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi cập nhật vai trò' });
    }
  }

  async updateUserPlan(req, res) {
    try {
      const { id } = req.params;
      const { plan, premiumTier } = req.body;

      const targetTier = premiumTier || (plan === 'premium' ? 'pro' : 'none');

      if (!['none', 'free', 'starter', 'pro', 'ultimate'].includes(targetTier)) {
        return res.status(400).json({ success: false, message: 'Gói hoặc Cấp độ Premium không hợp lệ' });
      }

      const premiumService = require('../services/premiumService');
      const PREMIUM_BADGES = ['PREMIUM_STARTER', 'PREMIUM_PRO', 'PREMIUM_ULTIMATE'];

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      }

      if (['none', 'free'].includes(targetTier)) {
        // Hạ xuống Free — thu hồi toàn bộ quyền lợi premium
        user.plan = 'free';
        user.premiumTier = 'none';
        user.premiumPurchasedAt = null;
        user.premiumExpiresAt = null;
        user.badges = user.badges.filter(b => !PREMIUM_BADGES.includes(b));
      } else {
        const now = new Date();
        const durationDays = premiumService.TIER_DURATION_DAYS[targetTier] || 30;
        user.plan = 'premium';
        user.premiumTier = targetTier;
        user.premiumPurchasedAt = now;
        user.premiumExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

        // Add appropriate badge
        const badgeMap = { starter: 'PREMIUM_STARTER', pro: 'PREMIUM_PRO', ultimate: 'PREMIUM_ULTIMATE' };
        if (badgeMap[targetTier] && !user.badges.includes(badgeMap[targetTier])) {
          user.badges.push(badgeMap[targetTier]);
        }
      }

      await user.save();

      res.json({
        success: true,
        message: `Đã cập nhật gói của ${user.displayName} thành ${targetTier.toUpperCase()}`,
        user,
      });
    } catch (error) {
      console.error('[AdminCtrl] Update user plan error:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi cập nhật gói người dùng' });
    }
  }

  /**
   * Delete a user's account
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      if (id === req.user.userId) {
        return res.status(400).json({ success: false, message: 'Bạn không thể tự xóa tài khoản của chính mình' });
      }

      const user = await User.findByIdAndDelete(id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      }

      res.json({
        success: true,
        message: `Đã xóa tài khoản của người dùng ${user.displayName}`,
      });
    } catch (error) {
      console.error('[AdminCtrl] Delete user error:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi xóa người dùng' });
    }
  }

  /**
   * Get all website reviews and feedbacks
   */
  async getFeedbacks(req, res) {
    try {
      const feedbacks = await Feedback.find()
        .populate('userId', 'displayName email avatar')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        feedbacks,
      });
    } catch (error) {
      console.error('[AdminCtrl] Get feedbacks error:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách phản hồi' });
    }
  }

  /**
   * Generate a new giftcode
   */
  async generateGiftcode(req, res) {
    try {
      const { planId, code, maxUses } = req.body;

      if (planId && !['starter', 'pro', 'ultimate'].includes(planId)) {
        return res.status(400).json({ success: false, message: 'Gói Premium của Giftcode không hợp lệ' });
      }

      // Validate maxUses
      const limitUses = maxUses !== undefined ? Number(maxUses) : 1;
      if (isNaN(limitUses) || limitUses < 0) {
        return res.status(400).json({ success: false, message: 'Số lượt sử dụng phải là số nguyên >= 0 (0 = không giới hạn)' });
      }

      // Generate custom code or random code
      let finalCode = code ? code.toUpperCase().trim() : '';
      if (!finalCode) {
        const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
        finalCode = `SR-${(planId || 'starter').toUpperCase()}-${randomChars}`;
      }

      const existing = await Giftcode.findOne({ code: finalCode });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Mã Giftcode này đã tồn tại' });
      }

      const giftcode = await Giftcode.create({
        code: finalCode,
        planId: planId || 'starter',
        maxUses: limitUses,
      });

      res.status(201).json({
        success: true,
        message: `Đã tạo thành công mã Giftcode: ${finalCode} (${limitUses === 0 ? 'Không giới hạn' : limitUses + ' lượt'})`,
        giftcode,
      });
    } catch (error) {
      console.error('[AdminCtrl] Generate giftcode error:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi tạo mã Giftcode' });
    }
  }

  /**
   * Get all generated giftcodes
   */
  async getGiftcodes(req, res) {
    try {
      const giftcodes = await Giftcode.find()
        .populate('usedBy', 'displayName email')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        giftcodes,
      });
    } catch (error) {
      console.error('[AdminCtrl] Get giftcodes error:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách Giftcode' });
    }
  }

  /**
   * Delete a giftcode
   */
  async deleteGiftcode(req, res) {
    try {
      const { id } = req.params;
      const giftcode = await Giftcode.findByIdAndDelete(id);
      if (!giftcode) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy Giftcode' });
      }
      res.json({
        success: true,
        message: 'Đã xóa mã Giftcode thành công',
      });
    } catch (error) {
      console.error('[AdminCtrl] Delete giftcode error:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi xóa mã Giftcode' });
    }
  }

  /**
   * Get setting configs
   */
  async getSettings(req, res) {
    try {
      const gaSetting = await Setting.findOne({ key: 'ga_measurement_id' });
      res.json({
        success: true,
        settings: {
          gaMeasurementId: gaSetting ? gaSetting.value : '',
        },
      });
    } catch (error) {
      console.error('[AdminCtrl] Get settings error:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi tải cấu hình' });
    }
  }

  /**
   * Update setting configs
   */
  async updateSettings(req, res) {
    try {
      const { gaMeasurementId } = req.body;
      await Setting.findOneAndUpdate(
        { key: 'ga_measurement_id' },
        { value: gaMeasurementId || '' },
        { upsert: true, new: true }
      );
      res.json({
        success: true,
        message: 'Đã cập nhật cấu hình Google Analytics thành công!',
      });
    } catch (error) {
      console.error('[AdminCtrl] Update settings error:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi lưu cấu hình' });
    }
  }
}

module.exports = new AdminController();
