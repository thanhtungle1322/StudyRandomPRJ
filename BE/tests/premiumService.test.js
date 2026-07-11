const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const premiumService = require('../services/premiumService');

const { PremiumService } = premiumService;

function createHarness({
  orderOverrides = {},
  userOverrides = {},
  verifier,
  paymentInfo,
  saveError,
} = {}) {
  const order = {
    _id: 'order-id',
    orderCode: 123456789,
    userId: 'user-a',
    planId: 'pro',
    amount: 75000,
    status: 'pending',
    fulfilledAt: null,
    ...orderOverrides,
  };
  let saveCalls = 0;
  let paymentGetCalls = 0;
  const user = {
    _id: 'user-a',
    plan: 'free',
    premiumTier: 'none',
    premiumExpiresAt: null,
    badges: [],
    ...userOverrides,
    async save() {
      saveCalls += 1;
      if (saveError) throw saveError;
    },
  };

  const matches = (query) => Object.entries(query).every(([key, value]) => {
    if (key === 'fulfilledAt' && value === null) return order.fulfilledAt == null;
    return order[key]?.toString() === value?.toString();
  });
  const applyUpdate = (update) => {
    Object.assign(order, update.$set || {});
    Object.keys(update.$unset || {}).forEach((key) => { delete order[key]; });
  };
  const OrderModel = {
    async findOne(query) {
      return matches(query) ? order : null;
    },
    async findOneAndUpdate(query, update) {
      if (!matches(query)) return null;
      applyUpdate(update);
      return order;
    },
    async updateOne(query, update) {
      if (!matches(query)) return { matchedCount: 0 };
      applyUpdate(update);
      return { matchedCount: 1 };
    },
  };
  const UserModel = {
    async findById(userId) {
      return userId.toString() === user._id.toString() ? user : null;
    },
    async updateOne(query, update) {
      if (query._id.toString() !== user._id.toString()) return { matchedCount: 0 };
      if (query.lastMatchDate?.$ne !== undefined && user.lastMatchDate === query.lastMatchDate.$ne) {
        return { matchedCount: 0 };
      }
      Object.assign(user, update.$set || {});
      return { matchedCount: 1 };
    },
    async findOneAndUpdate(query, update) {
      if (query._id.toString() !== user._id.toString()) return null;
      if (query.lastMatchDate !== undefined && user.lastMatchDate !== query.lastMatchDate) return null;
      if (query.dailyMatchCount?.$lt !== undefined && user.dailyMatchCount >= query.dailyMatchCount.$lt) return null;
      if (query.dailyMatchCount?.$gt !== undefined && user.dailyMatchCount <= query.dailyMatchCount.$gt) return null;
      user.dailyMatchCount += update.$inc?.dailyMatchCount || 0;
      return user;
    },
  };
  const payosClient = {
    webhooks: {
      verify: verifier || (async () => ({ orderCode: order.orderCode, amount: order.amount })),
    },
    paymentRequests: {
      async get() {
        paymentGetCalls += 1;
        return paymentInfo || { status: 'PAID', amount: order.amount };
      },
    },
  };
  const service = new PremiumService({
    UserModel,
    OrderModel,
    payosClient,
    now: () => new Date('2026-07-10T00:00:00.000Z'),
  });

  return {
    service,
    order,
    user,
    getSaveCalls: () => saveCalls,
    getPaymentGetCalls: () => paymentGetCalls,
  };
}

describe('PremiumService payment fulfillment', () => {
  test('reuses one PayOS checkout for concurrent purchases by the same user', async () => {
    const user = {
      _id: 'user-a',
      role: 'customer',
      plan: 'free',
      premiumTier: 'none',
      badges: [],
    };
    let order = null;
    let initialReads = 0;
    let releaseInitialReads;
    const initialReadBarrier = new Promise((resolve) => { releaseInitialReads = resolve; });
    let createLinkCalls = 0;

    const OrderModel = {
      async findOne(query) {
        if (query.userId && query.status?.$in) {
          initialReads += 1;
          if (initialReads === 2) releaseInitialReads();
          await initialReadBarrier;
          return null;
        }
        if (query.activePurchaseKey) {
          return order?.activePurchaseKey === query.activePurchaseKey ? order : null;
        }
        if (query._id) return order?._id === query._id ? order : null;
        return null;
      },
      async create(data) {
        if (order) {
          const error = new Error('duplicate key');
          error.code = 11000;
          throw error;
        }
        order = { _id: 'order-id', ...data };
        return order;
      },
      async findOneAndUpdate(query, update) {
        if (!order || order._id !== query._id || order.checkoutCreatingAt || order.checkoutUrl) return null;
        Object.assign(order, update.$set || {});
        return order;
      },
      async updateOne(query, update) {
        if (!order || order._id !== query._id) return { matchedCount: 0 };
        Object.assign(order, update.$set || {});
        Object.keys(update.$unset || {}).forEach((key) => { delete order[key]; });
        return { matchedCount: 1 };
      },
    };
    const service = new PremiumService({
      UserModel: { findById: async () => user },
      OrderModel,
      payosClient: {
        paymentRequests: {
          async create() {
            createLinkCalls += 1;
            await Promise.resolve();
            return { checkoutUrl: 'https://pay.example/one-order' };
          },
        },
      },
      now: () => new Date('2026-07-10T00:00:00.000Z'),
      sleep: () => new Promise((resolve) => setImmediate(resolve)),
    });

    const [first, second] = await Promise.all([
      service.purchasePremium('user-a', 'starter'),
      service.purchasePremium('user-a', 'starter'),
    ]);

    assert.equal(createLinkCalls, 1);
    assert.equal(first.orderCode, second.orderCode);
    assert.equal(first.checkoutUrl, second.checkoutUrl);
    assert.equal(order.activePurchaseKey, 'user-a');
  });

  test('awaits webhook verification before fulfilling the order', async () => {
    let verificationResolved = false;
    const harness = createHarness({
      verifier: async () => {
        await Promise.resolve();
        verificationResolved = true;
        return { orderCode: 123456789, amount: 75000 };
      },
    });

    const result = await harness.service.handleWebhook({ success: true, code: '00' });

    assert.equal(verificationResolved, true);
    assert.equal(result.success, true);
    assert.equal(harness.order.status, 'completed');
    assert.equal(harness.user.premiumTier, 'pro');
  });

  test('rejects browser verification for an order owned by another user', async () => {
    const harness = createHarness();

    await assert.rejects(
      harness.service.verifyOrder(harness.order.orderCode, 'user-b'),
      (error) => error.status === 403
    );
    assert.equal(harness.getPaymentGetCalls(), 0);
  });

  test('returns a claimed order to pending when entitlement persistence fails', async () => {
    const harness = createHarness({ saveError: new Error('database unavailable') });

    await assert.rejects(
      harness.service._fulfillOrder(harness.order.orderCode),
      /database unavailable/
    );
    assert.equal(harness.order.status, 'pending');
    assert.equal(harness.order.fulfillmentError, 'database unavailable');
  });

  test('never lets an older lower-tier order downgrade an active plan', async () => {
    const harness = createHarness({
      orderOverrides: { planId: 'starter', amount: 30000 },
      userOverrides: {
        plan: 'premium',
        premiumTier: 'ultimate',
        premiumExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
        badges: ['PREMIUM_ULTIMATE'],
      },
    });

    const result = await harness.service._fulfillOrder(harness.order.orderCode);

    assert.equal(result.entitlementGranted, false);
    assert.equal(harness.user.premiumTier, 'ultimate');
    assert.deepEqual(harness.user.badges, ['PREMIUM_ULTIMATE']);
    assert.equal(harness.getSaveCalls(), 0);
    assert.equal(harness.order.fulfillmentResult, 'superseded');
  });

  test('treats legacy completed orders without fulfillment metadata as terminal', async () => {
    const harness = createHarness({
      orderOverrides: { status: 'completed', fulfilledAt: undefined },
    });

    const result = await harness.service._fulfillOrder(harness.order.orderCode);

    assert.equal(result.success, true);
    assert.equal(result.legacyCompletion, true);
    assert.equal(harness.user.premiumTier, 'none');
    assert.equal(harness.getSaveCalls(), 0);
  });

  test('reclaims a stale processing order lease', async () => {
    const harness = createHarness({
      orderOverrides: {
        status: 'processing',
        processingAt: new Date('2026-07-09T23:50:00.000Z'),
      },
    });

    const result = await harness.service._fulfillOrder(harness.order.orderCode);

    assert.equal(result.success, true);
    assert.equal(harness.order.status, 'completed');
    assert.equal(harness.user.premiumTier, 'pro');
  });

  test('retries a conflicting entitlement write without downgrading the newer tier', async () => {
    let reads = 0;
    const staleUser = {
      _id: 'user-a',
      plan: 'free',
      premiumTier: 'none',
      premiumExpiresAt: null,
      badges: [],
      async save() {
        const error = new Error('version conflict');
        error.name = 'VersionError';
        throw error;
      },
    };
    const upgradedUser = {
      _id: 'user-a',
      plan: 'premium',
      premiumTier: 'ultimate',
      premiumExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      badges: ['PREMIUM_ULTIMATE'],
      async save() {
        throw new Error('lower tier must not be saved');
      },
    };
    const service = new PremiumService({
      UserModel: {
        async findById() {
          reads += 1;
          return reads === 1 ? staleUser : upgradedUser;
        },
      },
      OrderModel: {},
      payosClient: null,
      now: () => new Date('2026-07-10T00:00:00.000Z'),
    });

    const result = await service._persistPremiumEntitlement(
      'user-a',
      'starter',
      new Date('2026-07-10T00:00:00.000Z')
    );

    assert.equal(reads, 2);
    assert.equal(result.entitlement.granted, false);
    assert.equal(result.user.premiumTier, 'ultimate');
  });

  test('consumes finite daily quota atomically and rejects the next match', async () => {
    const harness = createHarness({
      userOverrides: {
        dailyMatchCount: 2,
        lastMatchDate: '2026-07-10',
      },
    });

    const finalSlot = await harness.service.consumeMatchQuota('user-a');
    const overLimit = await harness.service.consumeMatchQuota('user-a');

    assert.equal(finalSlot.allowed, true);
    assert.equal(finalSlot.user.dailyMatchCount, 3);
    assert.equal(overLimit.allowed, false);
    assert.equal(harness.user.dailyMatchCount, 3);
  });

  test('resets quota on a new UTC day before consuming', async () => {
    const harness = createHarness({
      userOverrides: {
        dailyMatchCount: 3,
        lastMatchDate: '2026-07-09',
      },
    });

    const result = await harness.service.consumeMatchQuota('user-a');

    assert.equal(result.allowed, true);
    assert.equal(harness.user.dailyMatchCount, 1);
    assert.equal(harness.user.lastMatchDate, '2026-07-10');
  });
});