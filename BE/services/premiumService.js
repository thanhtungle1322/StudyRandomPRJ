const User = require('../models/User');
const Order = require('../models/Order');
const { PayOS } = require('@payos/node');
const config = require('../config');
const { TIER_LEVELS } = require('../dtos/premiumDto');

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
const ORDER_PROCESSING_LEASE_MS = 15 * 1000;

class PremiumService {
  constructor(options = {}) {
    this.User = options.UserModel || User;
    this.Order = options.OrderModel || Order;
    this.payos = options.payosClient === undefined ? payos : options.payosClient;
    this.now = options.now || (() => new Date());
    this.sleep = options.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

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
    let user = await this.User.findById(userId);
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

    let user = await this.User.findById(userId);
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

    const returnUrl = `${config.clientUrl.split(',')[0].trim()}/payment-success`;
    const cancelUrl = `${config.clientUrl.split(',')[0].trim()}/pricing`;
    const order = await this._reservePendingOrder(userId, planId, amount);
    const paymentData = {
      orderCode: order.orderCode,
      amount,
      description: `StudyRandom ${plan.name}`,
      returnUrl,
      cancelUrl,
    };

    if (this.payos) {
      if (order.checkoutUrl) {
        return { usePayOS: true, checkoutUrl: order.checkoutUrl, orderCode: order.orderCode, reused: true };
      }

      try {
        const claimTime = this.now();
        const checkoutClaim = await this.Order.findOneAndUpdate(
          {
            _id: order._id,
            status: 'pending',
            checkoutUrl: { $exists: false },
            $or: [
              { checkoutCreatingAt: { $exists: false } },
              { checkoutCreatingAt: { $lt: new Date(claimTime.getTime() - 30_000) } },
            ],
          },
          { $set: { checkoutCreatingAt: claimTime } },
          { new: true }
        );

        if (!checkoutClaim) {
          for (let attempt = 0; attempt < 20; attempt += 1) {
            await this.sleep(100);
            const latestOrder = await this.Order.findOne({ _id: order._id });
            if (latestOrder?.checkoutUrl) {
              return {
                usePayOS: true,
                checkoutUrl: latestOrder.checkoutUrl,
                orderCode: latestOrder.orderCode,
                reused: true,
              };
            }
            if (!latestOrder || latestOrder.status !== 'pending') break;
          }
          throw { status: 409, message: 'Liên kết thanh toán đang được tạo, vui lòng thử lại sau giây lát.' };
        }

        console.log(`[PremiumService] Creating PayOS payment link for user ${userId}, plan ${planId}`);
        const paymentLinkResult = await this.payos.paymentRequests.create(paymentData);
        await this.Order.updateOne(
          { _id: order._id, status: 'pending', checkoutCreatingAt: claimTime },
          {
            $set: { checkoutUrl: paymentLinkResult.checkoutUrl },
            $unset: { checkoutCreatingAt: 1 },
          }
        );

        return {
          usePayOS: true,
          checkoutUrl: paymentLinkResult.checkoutUrl,
          orderCode: order.orderCode,
        };
      } catch (err) {
        await this.Order.updateOne(
          { _id: order._id, status: 'pending', checkoutUrl: { $exists: false } },
          {
            $set: { status: 'cancelled', fulfillmentError: err.message || 'Checkout creation failed' },
            $unset: { checkoutCreatingAt: 1, activePurchaseKey: 1 },
          }
        ).catch(() => { });
        console.error('[PremiumService] Failed to create PayOS link:', err);
        if (err?.status) throw err;
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
      const result = await this._fulfillOrder(order.orderCode, { expectedUserId: userId });
      return {
        usePayOS: false,
        message: `Chúc mừng! Bạn đã nâng cấp thành công lên gói ${plan.name} (${TIER_DURATION_DAYS[planId]} ngày)!`,
        ...result,
      };
    }
  }

  async _reservePendingOrder(userId, planId, amount) {
    const activePurchaseKey = userId.toString();
    const existingOrder = await this.Order.findOne({
      userId,
      status: { $in: ['pending', 'processing'] },
    });
    if (existingOrder) {
      if (existingOrder.planId !== planId) {
        throw { status: 409, message: 'Bạn đang có một giao dịch Premium khác chưa hoàn tất.' };
      }
      if (!existingOrder.activePurchaseKey) {
        await this.Order.updateOne(
          { _id: existingOrder._id, activePurchaseKey: { $exists: false } },
          { $set: { activePurchaseKey } }
        ).catch(() => { });
      }
      return existingOrder;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const orderCode = Number(
        String(Date.now()).slice(-6) +
        Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      );
      try {
        return await this.Order.create({
          orderCode,
          userId,
          planId,
          amount,
          status: 'pending',
          activePurchaseKey,
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;
        const concurrentOrder = await this.Order.findOne({ activePurchaseKey });
        if (concurrentOrder) {
          if (concurrentOrder.planId !== planId) {
            throw { status: 409, message: 'Bạn đang có một giao dịch Premium khác chưa hoàn tất.' };
          }
          return concurrentOrder;
        }
      }
    }
    throw { status: 503, message: 'Không thể tạo mã đơn hàng duy nhất, vui lòng thử lại' };
  }

  /**
   * Handle simulated instant purchase if PayOS is bypassed
   */
  async purchasePremiumDirect(userId, planId) {
    const plan = PREMIUM_PLANS[planId];
    const user = await this.User.findById(userId);
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
  async verifyOrder(orderCode, expectedUserId) {
    const numericOrderCode = Number(orderCode);
    const order = await this.Order.findOne({ orderCode: numericOrderCode });
    if (!order) {
      throw { status: 404, message: 'Không tìm thấy đơn hàng' };
    }
    if (expectedUserId && order.userId.toString() !== expectedUserId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền xác minh đơn hàng này' };
    }

    if (order.status === 'completed') {
      await this.Order.updateOne({ _id: order._id }, { $unset: { activePurchaseKey: 1 } });
      return {
        success: true,
        message: 'Đơn hàng đã được thanh toán thành công trước đó!',
        planId: order.planId,
        legacyCompletion: !order.fulfilledAt,
      };
    }

    if (this.payos) {
      try {
        console.log(`[PremiumService] Calling PayOS to verify order: ${orderCode}`);
        const paymentInfo = await this.payos.paymentRequests.get(numericOrderCode);
        console.log(`[PremiumService] PayOS actual order status: ${paymentInfo.status}`);

        if (paymentInfo.status === 'PAID') {
          return this._fulfillOrder(numericOrderCode, {
            expectedUserId,
            paidAmount: paymentInfo.amount,
          });
        } else if (paymentInfo.status === 'CANCELLED') {
          await this.Order.updateOne(
            { _id: order._id, status: 'pending' },
            {
              $set: { status: 'cancelled' },
              $unset: { activePurchaseKey: 1, checkoutCreatingAt: 1 },
            }
          );
          throw { status: 400, message: 'Giao dịch đã bị hủy bỏ.' };
        } else {
          return { success: false, status: paymentInfo.status, message: 'Giao dịch đang chờ thanh toán.' };
        }
      } catch (err) {
        console.error('[PremiumService] Error verifying order with PayOS:', err);
        if (err?.status) throw err;
        throw { status: 502, message: 'Lỗi khi xác minh giao dịch với PayOS' };
      }
    } else {
      return this._fulfillOrder(numericOrderCode, { expectedUserId });
    }
  }

  _applyPremiumEntitlement(user, planId, now) {
    const currentTier = user.premiumTier || 'none';
    const currentExpiry = user.premiumExpiresAt ? new Date(user.premiumExpiresAt) : null;
    const currentPlanActive = user.plan === 'premium' && (!currentExpiry || currentExpiry > now);
    if (currentPlanActive && (TIER_LEVELS[currentTier] || 0) >= TIER_LEVELS[planId]) {
      return { granted: false, result: 'superseded' };
    }

    const durationDays = TIER_DURATION_DAYS[planId] || 30;
    user.plan = 'premium';
    user.premiumTier = planId;
    user.premiumPurchasedAt = now;
    user.premiumExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    user.badges = (user.badges || []).filter((badge) => !PREMIUM_BADGES.includes(badge));
    const badgeMap = { starter: 'PREMIUM_STARTER', pro: 'PREMIUM_PRO', ultimate: 'PREMIUM_ULTIMATE' };
    user.badges.push(badgeMap[planId]);
    return { granted: true, result: 'granted' };
  }

  async _persistPremiumEntitlement(userId, planId, now) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const user = await this.User.findById(userId);
      if (!user) throw { status: 404, message: 'Không tìm thấy user của đơn hàng' };

      const entitlement = this._applyPremiumEntitlement(user, planId, now);
      if (!entitlement.granted) return { user, entitlement };

      try {
        await user.save();
        return { user, entitlement };
      } catch (error) {
        if (error?.name !== 'VersionError' || attempt === 2) throw error;
      }
    }
    throw { status: 409, message: 'Quyền lợi đang được cập nhật, vui lòng thử lại' };
  }

  async _fulfillOrder(orderCode, { expectedUserId, paidAmount } = {}) {
    const numericOrderCode = Number(orderCode);
    if (!Number.isSafeInteger(numericOrderCode) || numericOrderCode <= 0) {
      throw { status: 400, message: 'Mã đơn hàng không hợp lệ' };
    }

    let order = await this.Order.findOne({ orderCode: numericOrderCode });
    if (!order) throw { status: 404, message: 'Không tìm thấy đơn hàng' };
    if (expectedUserId && order.userId.toString() !== expectedUserId.toString()) {
      throw { status: 403, message: 'Bạn không có quyền xác minh đơn hàng này' };
    }

    const plan = PREMIUM_PLANS[order.planId];
    if (!plan || order.amount !== plan.price) {
      throw { status: 409, message: 'Thông tin đơn hàng không khớp bảng giá' };
    }
    if (paidAmount !== undefined && Number(paidAmount) !== order.amount) {
      throw { status: 409, message: 'Số tiền thanh toán không khớp đơn hàng' };
    }
    if (order.status === 'cancelled') {
      throw { status: 400, message: 'Giao dịch đã bị hủy bỏ' };
    }
    if (order.status === 'completed') {
      await this.Order.updateOne({ _id: order._id }, { $unset: { activePurchaseKey: 1 } });
      return {
        success: true,
        message: 'Đơn hàng đã được xử lý trước đó',
        planId: order.planId,
        legacyCompletion: !order.fulfilledAt,
      };
    }

    const claimTime = this.now();
    let claimFilter;
    if (order.status === 'processing') {
      const processingAt = order.processingAt ? new Date(order.processingAt) : null;
      const leaseAge = processingAt ? claimTime.getTime() - processingAt.getTime() : Infinity;
      if (leaseAge < ORDER_PROCESSING_LEASE_MS) {
        return {
          success: false,
          status: 'PROCESSING',
          message: 'Đơn hàng đang được xử lý, vui lòng đợi trong giây lát.',
          retryAfterMs: Math.max(500, ORDER_PROCESSING_LEASE_MS - leaseAge),
        };
      }
      claimFilter = { _id: order._id, status: 'processing' };
      if (processingAt) claimFilter.processingAt = order.processingAt;
    } else if (order.status === 'pending') {
      claimFilter = { _id: order._id, status: 'pending' };
    } else {
      throw { status: 409, message: 'Trạng thái đơn hàng không thể xử lý' };
    }

    order = await this.Order.findOneAndUpdate(
      claimFilter,
      {
        $set: { status: 'processing', processingAt: claimTime },
        $unset: { fulfillmentError: 1 },
      },
      { new: true }
    );
    if (!order) {
      const latest = await this.Order.findOne({ orderCode: numericOrderCode });
      if (latest?.status === 'completed' && latest.fulfilledAt) {
        return { success: true, message: 'Đơn hàng đã được xử lý trước đó', planId: latest.planId };
      }
      if (latest?.status === 'processing') {
        return { success: false, status: 'PROCESSING', message: 'Đơn hàng đang được xử lý, vui lòng thử lại.' };
      }
      throw { status: 409, message: 'Không thể giữ quyền xử lý đơn hàng' };
    }

    let entitlementSaved = false;
    try {
      const now = this.now();
      const { user, entitlement } = await this._persistPremiumEntitlement(order.userId, order.planId, now);
      entitlementSaved = true;

      const completion = await this.Order.updateOne(
        { _id: order._id, status: 'processing' },
        {
          $set: {
            status: 'completed',
            fulfilledAt: now,
            fulfillmentResult: entitlement.result,
          },
          $unset: { processingAt: 1, fulfillmentError: 1, activePurchaseKey: 1, checkoutCreatingAt: 1 },
        }
      );
      if (completion?.matchedCount === 0) {
        throw { status: 503, message: 'Không thể hoàn tất trạng thái đơn hàng' };
      }

      return {
        success: true,
        message: entitlement.granted
          ? 'Thanh toán thành công! Gói Premium của bạn đã được kích hoạt.'
          : 'Thanh toán đã ghi nhận; quyền lợi cao hơn hiện tại được giữ nguyên.',
        planId: order.planId,
        premiumTier: user.premiumTier,
        premiumExpiresAt: user.premiumExpiresAt,
        entitlementGranted: entitlement.granted,
      };
    } catch (error) {
      if (!entitlementSaved) {
        await this.Order.updateOne(
          { _id: order._id, status: 'processing' },
          {
            $set: { status: 'pending', fulfillmentError: error.message || 'Fulfillment failed' },
            $unset: { processingAt: 1 },
          }
        ).catch(() => {});
      } else {
        await this.Order.updateOne(
          { _id: order._id, status: 'processing' },
          { $set: { fulfillmentError: error.message || 'Order finalization failed' } }
        ).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Process webhook request sent by PayOS
   */
  async handleWebhook(webhookBody) {
    if (!this.payos) {
      console.warn('[PayOS Webhook] Received but PayOS client is not configured.');
      return { success: false, message: 'PayOS not configured' };
    }

    try {
      const verifiedData = await this.payos.webhooks.verify(webhookBody);
      if (webhookBody.success !== true || webhookBody.code !== '00') {
        return { success: true, message: 'Webhook acknowledged without fulfillment' };
      }
      return this._fulfillOrder(verifiedData.orderCode, { paidAmount: verifiedData.amount });
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

  async consumeMatchQuota(userId) {
    let user = await this.User.findById(userId);
    if (!user) throw { status: 404, message: 'Không tìm thấy user' };
    user = await this.checkAndExpirePremium(user);

    const limits = this.getLimitsForTier(user.premiumTier || 'none');
    if (limits.dailyMatches === Infinity) {
      return { allowed: true, consumed: false, user, limits };
    }

    const today = this.now().toISOString().split('T')[0];
    await this.User.updateOne(
      { _id: userId, lastMatchDate: { $ne: today } },
      { $set: { lastMatchDate: today, dailyMatchCount: 0 } }
    );
    const updatedUser = await this.User.findOneAndUpdate(
      {
        _id: userId,
        lastMatchDate: today,
        dailyMatchCount: { $lt: limits.dailyMatches },
      },
      { $inc: { dailyMatchCount: 1 } },
      { new: true }
    );

    if (!updatedUser) {
      return { allowed: false, consumed: false, user, limits };
    }
    return { allowed: true, consumed: true, user: updatedUser, limits };
  }

  async refundMatchQuota(userId) {
    const today = this.now().toISOString().split('T')[0];
    const user = await this.User.findOneAndUpdate(
      {
        _id: userId,
        lastMatchDate: today,
        dailyMatchCount: { $gt: 0 },
      },
      { $inc: { dailyMatchCount: -1 } },
      { new: true }
    );
    return {
      refunded: Boolean(user),
      dailyMatchCount: user?.dailyMatchCount,
      user,
    };
  }
}

const premiumService = new PremiumService();
premiumService.PremiumService = PremiumService;
module.exports = premiumService;
