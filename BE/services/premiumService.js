const User = require('../models/User');

const PREMIUM_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 49000,
    description: 'Trải nghiệm cơ bản không giới hạn',
    features: [
      'Tìm bạn học không giới hạn',
      'Không giới hạn thời gian phiên học',
      'Badge "Starter" độc quyền',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 99000,
    description: 'Trọn gói cho học sinh nghiêm túc',
    features: [
      'Tất cả tính năng Starter',
      'Ưu tiên ghép đôi nhanh hơn',
      'Badge "Pro" độc quyền',
      'Hỗ trợ ưu tiên',
    ],
    popular: true,
  },
  ultimate: {
    id: 'ultimate',
    name: 'Ultimate',
    price: 199000,
    description: 'Trải nghiệm cao cấp nhất',
    features: [
      'Tất cả tính năng Pro',
      'Badge "Ultimate" huyền thoại',
      'Truy cập tính năng beta sớm',
      'Hỗ trợ VIP 24/7',
    ],
  },
};

const FREE_LIMITS = {
  dailyMatches: 3,
  sessionMinutes: 30,
};

class PremiumService {
  get PREMIUM_PLANS() { return PREMIUM_PLANS; }
  get FREE_LIMITS() { return FREE_LIMITS; }

  /**
   * Get plans list and free limits configuration
   */
  getPlans() {
    return {
      plans: Object.values(PREMIUM_PLANS),
      freeLimits: FREE_LIMITS,
    };
  }

  /**
   * Get premium status of user
   */
  async getPremiumStatus(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyMatchCount = user.lastMatchDate === today ? user.dailyMatchCount : 0;

    return {
      plan: user.plan,
      premiumPurchasedAt: user.premiumPurchasedAt,
      isPremium: user.plan === 'premium',
      limits: user.plan === 'free' ? {
        dailyMatches: FREE_LIMITS.dailyMatches,
        dailyMatchesUsed: dailyMatchCount,
        dailyMatchesRemaining: Math.max(0, FREE_LIMITS.dailyMatches - dailyMatchCount),
        sessionMinutes: FREE_LIMITS.sessionMinutes,
      } : null,
    };
  }

  /**
   * Purchase a premium plan
   */
  async purchasePremium(userId, planId) {
    if (!planId || !PREMIUM_PLANS[planId]) {
      throw { status: 400, message: 'Gói không hợp lệ' };
    }

    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }

    if (user.plan === 'premium') {
      throw { status: 400, message: 'Bạn đã có gói Premium rồi!' };
    }

    const plan = PREMIUM_PLANS[planId];

    user.plan = 'premium';
    user.premiumPurchasedAt = new Date();

    const badgeMap = { starter: 'PREMIUM_STARTER', pro: 'PREMIUM_PRO', ultimate: 'PREMIUM_ULTIMATE' };
    if (badgeMap[planId] && !user.badges.includes(badgeMap[planId])) {
      user.badges.push(badgeMap[planId]);
    }

    await user.save();

    return {
      message: `Chúc mừng! Bạn đã nâng cấp lên gói ${plan.name} thành công! 🎉`,
      plan: user.plan,
      premiumPurchasedAt: user.premiumPurchasedAt,
      badges: user.badges,
    };
  }

  /**
   * Check if user is allowed to perform matchmaking
   */
  async checkMatchLimit(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }

    if (user.plan === 'premium') {
      return { success: true, allowed: true, isPremium: true };
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyCount = user.lastMatchDate === today ? user.dailyMatchCount : 0;
    const remaining = Math.max(0, FREE_LIMITS.dailyMatches - dailyCount);

    return {
      allowed: remaining > 0,
      isPremium: false,
      remaining,
      limit: FREE_LIMITS.dailyMatches,
      sessionMinutes: FREE_LIMITS.sessionMinutes,
    };
  }
}

module.exports = new PremiumService();
