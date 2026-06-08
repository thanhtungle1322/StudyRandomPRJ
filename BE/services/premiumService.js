const User = require('../models/User');
const { PayOS } = require('@payos/node');
const config = require('../config');

let payos;
if (config.payosClientId && config.payosApiKey && config.payosChecksumKey) {
  payos = new PayOS({
    clientId: config.payosClientId,
    apiKey: config.payosApiKey,
    checksumKey: config.payosChecksumKey,
  });
  console.log('[PayOS] Initialized successfully with credentials.');
} else {
  console.warn('[PayOS] Credentials missing in environment variables. Running in simulated MOCK mode.');
}

const PREMIUM_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 30000,
    description: 'Mở rộng giới hạn cơ bản cho việc ôn tập',
    features: [
      '15 lượt tìm bạn học / ngày (thay vì 3)',
      'Phiên học tối đa 60 phút (thay vì 30)',
      'Thời hạn sử dụng: 30 ngày',
      'Khung avatar "Starter Spark" hồng lấp lánh',
      'Danh hiệu PREMIUM STARTER trong hồ sơ',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 75000,
    description: 'Không giới hạn lượt tìm, phiên học 3 tiếng',
    features: [
      'Không giới hạn lượt tìm bạn học / ngày',
      'Phiên học tối đa 180 phút (3 tiếng)',
      'Thời hạn sử dụng: 90 ngày',
      'Khung avatar "Pro Crown" vương miện vàng',
      'Danh hiệu PREMIUM PRO trong hồ sơ',
      'Ưu tiên ghép đôi nhanh hơn',
    ],
    popular: true,
  },
  ultimate: {
    id: 'ultimate',
    name: 'Ultimate',
    price: 150000,
    description: 'Trải nghiệm tối thượng, không giới hạn bất kỳ điều gì',
    features: [
      'Không giới hạn lượt tìm bạn học / ngày',
      'Không giới hạn thời gian phiên học',
      'Thời hạn sử dụng: 365 ngày (1 năm)',
      'Khung avatar "Ultimate Cosmic" vũ trụ huyền ảo',
      'Danh hiệu PREMIUM ULTIMATE trong hồ sơ',
      'Truy cập tính năng beta sớm',
      'Hỗ trợ VIP 24/7',
    ],
  },
};

const FREE_LIMITS = {
  dailyMatches: 3,
  sessionMinutes: 30,
};

// Thời hạn sử dụng gói (ngày)
const TIER_DURATION_DAYS = {
  starter: 30,
  pro: 90,
  ultimate: 365,
};

const PREMIUM_BADGES = ['PREMIUM_STARTER', 'PREMIUM_PRO', 'PREMIUM_ULTIMATE'];

class PremiumService {
  get PREMIUM_PLANS() { return PREMIUM_PLANS; }
  get FREE_LIMITS() { return FREE_LIMITS; }
  get TIER_DURATION_DAYS() { return TIER_DURATION_DAYS; }

  /**
   * Get plans list and free limits configuration
   */
  getPlans() {
    return {
      plans: Object.values(PREMIUM_PLANS).map(p => ({
        ...p,
        durationDays: TIER_DURATION_DAYS[p.id] || 30,
      })),
      freeLimits: FREE_LIMITS,
    };
  }

  getLimitsForTier(tier) {
    const limits = {
      none: { dailyMatches: 3, sessionMinutes: 30 },
      free: { dailyMatches: 3, sessionMinutes: 30 },
      starter: { dailyMatches: 15, sessionMinutes: 60 },
      pro: { dailyMatches: Infinity, sessionMinutes: 180 },
      ultimate: { dailyMatches: Infinity, sessionMinutes: Infinity }
    };
    return limits[tier] || limits.none;
  }

  /**
   * Kiểm tra và tự động hết hạn gói Premium nếu đã quá ngày.
   * Khi hết hạn: xoá plan, premiumTier, badge premium, khung avatar.
   * Trả về user đã cập nhật (hoặc user gốc nếu chưa hết hạn).
   */
  async checkAndExpirePremium(user) {
    if (!user || user.plan !== 'premium') return user;
    // Admin không bao giờ hết hạn
    if (user.role === 'admin') return user;
    // Nếu không có ngày hết hạn thì coi như vĩnh viễn (legacy)
    if (!user.premiumExpiresAt) return user;

    const now = new Date();
    if (now < new Date(user.premiumExpiresAt)) return user;

    // === HẾT HẠN — Thu hồi toàn bộ quyền lợi ===
    console.log(`[PremiumService] Gói Premium của ${user.displayName} đã hết hạn. Thu hồi quyền lợi...`);
    user.plan = 'free';
    user.premiumTier = 'none';
    user.premiumPurchasedAt = null;
    user.premiumExpiresAt = null;
    // Xoá tất cả badge premium
    user.badges = user.badges.filter(b => !PREMIUM_BADGES.includes(b));
    await user.save();
    return user;
  }

  /**
   * Get premium status of user
   */
  async getPremiumStatus(userId) {
    let user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }

    // Auto-expire nếu hết hạn
    user = await this.checkAndExpirePremium(user);

    const tier = user.premiumTier || 'none';
    const today = new Date().toISOString().split('T')[0];
    const dailyMatchCount = user.lastMatchDate === today ? user.dailyMatchCount : 0;
    const tierLimits = this.getLimitsForTier(tier);

    const dailyMatchesRemaining = tierLimits.dailyMatches === Infinity
      ? Infinity
      : Math.max(0, tierLimits.dailyMatches - dailyMatchCount);

    return {
      plan: user.plan,
      premiumTier: tier,
      premiumPurchasedAt: user.premiumPurchasedAt,
      premiumExpiresAt: user.premiumExpiresAt,
      isPremium: user.plan === 'premium',
      limits: {
        dailyMatches: tierLimits.dailyMatches,
        dailyMatchesUsed: dailyMatchCount,
        dailyMatchesRemaining,
        sessionMinutes: tierLimits.sessionMinutes,
      },
    };
  }

  /**
   * Purchase a premium plan
   */
  /**
   * Create a checkout transaction with PayOS
   */
  async purchasePremium(userId, planId) {
    if (!planId || !PREMIUM_PLANS[planId]) {
      throw { status: 400, message: 'Gói không hợp lệ' };
    }

    let user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }

    // Admin luôn ở gói ultimate, không cần mua
    if (user.role === 'admin') {
      throw { status: 400, message: 'Admin đã có gói Ultimate vĩnh viễn, không cần mua thêm.' };
    }

    // Auto-expire trước khi kiểm tra upgrade
    user = await this.checkAndExpirePremium(user);

    const { PremiumDto } = require('../dtos/premiumDto');
    PremiumDto.validateUpgrade(user.premiumTier, planId);

    const plan = PREMIUM_PLANS[planId];
    const amount = plan.price;

    // Generate unique positive integer orderCode
    const orderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0'));

    const returnUrl = `${config.clientUrl.split(',')[0].trim()}/payment-success`;
    const cancelUrl = `${config.clientUrl.split(',')[0].trim()}/pricing`;

    const paymentData = {
      orderCode,
      amount,
      description: `StudyRandom ${plan.name}`,
      returnUrl,
      cancelUrl,
    };

    const Order = require('../models/Order');

    if (payos) {
      try {
        console.log(`[PremiumService] Creating PayOS payment link for user ${userId}, plan ${planId}`);
        const paymentLinkResult = await payos.paymentRequests.create(paymentData);

        await Order.create({
          orderCode,
          userId,
          planId,
          amount,
          status: 'pending',
          checkoutUrl: paymentLinkResult.checkoutUrl,
        });

        return {
          usePayOS: true,
          checkoutUrl: paymentLinkResult.checkoutUrl,
          orderCode,
        };
      } catch (err) {
        console.error('[PremiumService] Failed to create PayOS link:', err);
        throw {
          status: 400,
          message: `Lỗi kết nối PayOS: ${err.message || 'Không thể tạo liên kết thanh toán. Vui lòng kiểm tra lại cấu hình API Keys trên PayOS Dashboard.'}`
        };
      }
    } else {
      // Chỉ tự động Mock khi CHƯA KHAI BÁO biến môi trường PayOS ở môi trường development
      if (config.nodeEnv === 'production') {
        throw {
          status: 500,
          message: 'Lỗi bảo mật: Cấu hình PayOS chưa hoàn tất hoặc thiếu biến môi trường trên máy chủ Production!'
        };
      }

      // Create mock transaction in DB and directly activate for easy testing
      await Order.create({
        orderCode,
        userId,
        planId,
        amount,
        status: 'completed',
      });
      return this.purchasePremiumDirect(userId, planId);
    }
  }

  /**
   * Handle simulated instant purchase if PayOS is bypassed
   */
  async purchasePremiumDirect(userId, planId) {
    const plan = PREMIUM_PLANS[planId];
    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }

    const now = new Date();
    const durationDays = TIER_DURATION_DAYS[planId] || 30;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    user.plan = 'premium';
    user.premiumTier = planId;
    user.premiumPurchasedAt = now;
    user.premiumExpiresAt = expiresAt;

    const badgeMap = { starter: 'PREMIUM_STARTER', pro: 'PREMIUM_PRO', ultimate: 'PREMIUM_ULTIMATE' };
    if (badgeMap[planId] && !user.badges.includes(badgeMap[planId])) {
      user.badges.push(badgeMap[planId]);
    }

    await user.save();

    return {
      usePayOS: false,
      message: `Chúc mừng! Bạn đã nâng cấp thành công lên gói ${plan.name} (${durationDays} ngày)! 🎉`,
      plan: user.plan,
      premiumTier: user.premiumTier,
      premiumPurchasedAt: user.premiumPurchasedAt,
      premiumExpiresAt: user.premiumExpiresAt,
      badges: user.badges,
    };
  }

  /**
   * Redeem a giftcode to get Premium plan
   */
  async redeemGiftcode(userId, code) {
    if (!code) {
      throw { status: 400, message: 'Vui lòng cung cấp mã Giftcode' };
    }

    const Giftcode = require('../models/Giftcode');
    const cleanedCode = code.toUpperCase().trim();
    const giftcode = await Giftcode.findOne({ code: cleanedCode });

    if (!giftcode) {
      throw { status: 404, message: 'Mã Giftcode không hợp lệ hoặc không tồn tại' };
    }

    // Check usage limit: maxUses=0 means unlimited
    if (giftcode.maxUses > 0 && giftcode.usedCount >= giftcode.maxUses) {
      throw { status: 400, message: 'Mã Giftcode này đã hết lượt sử dụng' };
    }

    // Check if this specific user already used this code
    const alreadyUsed = giftcode.usedByList && giftcode.usedByList.some(
      entry => entry.userId.toString() === userId.toString()
    );
    if (alreadyUsed) {
      throw { status: 400, message: 'Bạn đã sử dụng mã Giftcode này trước đó rồi' };
    }

    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }

    const planId = giftcode.planId || 'starter';
    const { PremiumDto } = require('../dtos/premiumDto');
    PremiumDto.validateUpgrade(user.premiumTier, planId);

    // Activate premium with expiration
    const now = new Date();
    const durationDays = TIER_DURATION_DAYS[planId] || 30;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    user.plan = 'premium';
    user.premiumTier = planId;
    user.premiumPurchasedAt = now;
    user.premiumExpiresAt = expiresAt;

    const planName = PREMIUM_PLANS[planId]?.name || 'Starter';
    const badgeMap = { starter: 'PREMIUM_STARTER', pro: 'PREMIUM_PRO', ultimate: 'PREMIUM_ULTIMATE' };
    if (badgeMap[planId] && !user.badges.includes(badgeMap[planId])) {
      user.badges.push(badgeMap[planId]);
    }

    // Update giftcode usage tracking
    giftcode.usedCount += 1;
    giftcode.usedBy = userId;       // Last user who redeemed
    giftcode.usedAt = new Date();   // Last redemption time
    if (!giftcode.usedByList) giftcode.usedByList = [];
    giftcode.usedByList.push({ userId, usedAt: new Date() });

    // Mark as fully used if limit reached
    if (giftcode.maxUses > 0 && giftcode.usedCount >= giftcode.maxUses) {
      giftcode.isUsed = true;
    }

    await user.save();
    await giftcode.save();

    return {
      message: `Chúc mừng! Bạn đã kích hoạt gói ${planName} (${durationDays} ngày) thành công bằng mã Giftcode! 🎉`,
      plan: user.plan,
      premiumTier: user.premiumTier,
      premiumPurchasedAt: user.premiumPurchasedAt,
      premiumExpiresAt: user.premiumExpiresAt,
      badges: user.badges,
    };
  }

  /**
   * Verify order code directly by calling PayOS API or resolving mock transaction
   */
  async verifyOrder(orderCode) {
    const Order = require('../models/Order');
    const order = await Order.findOne({ orderCode: Number(orderCode) });
    if (!order) {
      throw { status: 404, message: 'Không tìm thấy đơn hàng' };
    }

    if (order.status === 'completed') {
      return { success: true, message: 'Đơn hàng đã được thanh toán thành công trước đó!', planId: order.planId };
    }

    if (payos) {
      try {
        console.log(`[PremiumService] Calling PayOS to verify order: ${orderCode}`);
        const paymentInfo = await payos.paymentRequests.get(orderCode);
        console.log(`[PremiumService] PayOS actual order status: ${paymentInfo.status}`);

        if (paymentInfo.status === 'PAID') {
          order.status = 'completed';
          await order.save();

          const user = await User.findById(order.userId);
          if (user) {
            const now = new Date();
            const durationDays = TIER_DURATION_DAYS[order.planId] || 30;
            user.plan = 'premium';
            user.premiumTier = order.planId;
            user.premiumPurchasedAt = now;
            user.premiumExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
            const badgeMap = { starter: 'PREMIUM_STARTER', pro: 'PREMIUM_PRO', ultimate: 'PREMIUM_ULTIMATE' };
            if (badgeMap[order.planId] && !user.badges.includes(badgeMap[order.planId])) {
              user.badges.push(badgeMap[order.planId]);
            }
            await user.save();
          }

          return { success: true, message: 'Thanh toán thành công! Gói Premium của bạn đã được kích hoạt. 🎉', planId: order.planId };
        } else if (paymentInfo.status === 'CANCELLED') {
          order.status = 'cancelled';
          await order.save();
          throw { status: 400, message: 'Giao dịch đã bị hủy bỏ.' };
        } else {
          return { success: false, status: paymentInfo.status, message: 'Giao dịch đang chờ thanh toán.' };
        }
      } catch (err) {
        console.error('[PremiumService] Error verifying order with PayOS:', err);
        throw { status: 500, message: 'Lỗi khi xác minh giao dịch với PayOS' };
      }
    } else {
      // Simulated activation
      order.status = 'completed';
      await order.save();

      const user = await User.findById(order.userId);
      if (user) {
        const now = new Date();
        const durationDays = TIER_DURATION_DAYS[order.planId] || 30;
        user.plan = 'premium';
        user.premiumTier = order.planId;
        user.premiumPurchasedAt = now;
        user.premiumExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const badgeMap = { starter: 'PREMIUM_STARTER', pro: 'PREMIUM_PRO', ultimate: 'PREMIUM_ULTIMATE' };
        if (badgeMap[order.planId] && !user.badges.includes(badgeMap[order.planId])) {
          user.badges.push(badgeMap[order.planId]);
        }
        await user.save();
      }

      return { success: true, message: 'Xác minh thành công! Gói Premium đã được kích hoạt. 🎉', planId: order.planId };
    }
  }

  /**
   * Process webhook request sent by PayOS
   */
  async handleWebhook(webhookBody) {
    if (!payos) {
      console.warn('[PayOS Webhook] Received but PayOS client is not configured.');
      return { success: false, message: 'PayOS not configured' };
    }

    try {
      const verifiedData = payos.webhooks.verify(webhookBody);
      console.log('[PayOS Webhook] Verified webhook payload data:', verifiedData);

      const orderCode = verifiedData.orderCode;
      const Order = require('../models/Order');

      const order = await Order.findOne({ orderCode });
      if (!order) {
        console.error(`[PayOS Webhook] Order not found: ${orderCode}`);
        return { success: false, message: 'Order not found' };
      }

      if (order.status === 'completed') {
        return { success: true, message: 'Already processed' };
      }

      order.status = 'completed';
      await order.save();

      const user = await User.findById(order.userId);
      if (user) {
        const now = new Date();
        const durationDays = TIER_DURATION_DAYS[order.planId] || 30;
        user.plan = 'premium';
        user.premiumTier = order.planId;
        user.premiumPurchasedAt = now;
        user.premiumExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const badgeMap = { starter: 'PREMIUM_STARTER', pro: 'PREMIUM_PRO', ultimate: 'PREMIUM_ULTIMATE' };
        if (badgeMap[order.planId] && !user.badges.includes(badgeMap[order.planId])) {
          user.badges.push(badgeMap[order.planId]);
        }
        await user.save();
        console.log(`[PayOS Webhook] Upgraded user ${user.displayName} to Premium successfully!`);
      }

      return { success: true };
    } catch (err) {
      console.error('[PayOS Webhook] Verification error:', err);
      throw { status: 400, message: 'Invalid signature or payload' };
    }
  }

  /**
   * Check if user is allowed to perform matchmaking
   */
  async checkMatchLimit(userId) {
    let user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy user' };
    }

    // Auto-expire nếu hết hạn
    user = await this.checkAndExpirePremium(user);

    const tier = user.premiumTier || 'none';
    const limits = this.getLimitsForTier(tier);

    if (limits.dailyMatches === Infinity) {
      return { success: true, allowed: true, isPremium: tier !== 'none', tier };
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyCount = user.lastMatchDate === today ? user.dailyMatchCount : 0;
    const remaining = Math.max(0, limits.dailyMatches - dailyCount);

    return {
      allowed: remaining > 0,
      isPremium: tier !== 'none',
      tier,
      remaining,
      limit: limits.dailyMatches,
      sessionMinutes: limits.sessionMinutes,
    };
  }
}

module.exports = new PremiumService();
