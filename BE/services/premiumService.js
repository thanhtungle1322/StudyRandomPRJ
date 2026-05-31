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
    price: 5000,
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
    price: 10000,
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
    price: 15000,
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
  /**
   * Create a checkout transaction with PayOS
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
        const paymentLinkResult = await payos.createPaymentLink(paymentData);
        
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
        console.error('[PremiumService] Failed to create PayOS link, falling back to direct mock:', err.message);
        return this.purchasePremiumDirect(userId, planId);
      }
    } else {
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

    user.plan = 'premium';
    user.premiumPurchasedAt = new Date();

    const badgeMap = { starter: 'PREMIUM_STARTER', pro: 'PREMIUM_PRO', ultimate: 'PREMIUM_ULTIMATE' };
    if (badgeMap[planId] && !user.badges.includes(badgeMap[planId])) {
      user.badges.push(badgeMap[planId]);
    }

    await user.save();

    return {
      usePayOS: false,
      message: `Chúc mừng! Bạn đã nâng cấp thành công lên gói ${plan.name}! 🎉`,
      plan: user.plan,
      premiumPurchasedAt: user.premiumPurchasedAt,
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
        const paymentInfo = await payos.getPaymentLinkInformation(orderCode);
        console.log(`[PremiumService] PayOS actual order status: ${paymentInfo.status}`);

        if (paymentInfo.status === 'PAID') {
          order.status = 'completed';
          await order.save();

          const user = await User.findById(order.userId);
          if (user) {
            user.plan = 'premium';
            user.premiumPurchasedAt = new Date();
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
        user.plan = 'premium';
        user.premiumPurchasedAt = new Date();
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
      const verifiedData = payos.verifyPaymentWebhookData(webhookBody);
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
        user.plan = 'premium';
        user.premiumPurchasedAt = new Date();
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
