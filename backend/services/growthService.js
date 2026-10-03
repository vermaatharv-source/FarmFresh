/**
 * Growth Service – Referral, Coupon, Wallet, First-order logic
 * Central place for all acquisition & retention business rules
 */
const crypto = require('crypto');
const Coupon = require('../models/Coupon');
const Referral = require('../models/Referral');
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const FpoOrder = require('../models/FpoOrder');

// ---------- Helpers ----------
function generateReferralCode(name = '') {
  const prefix = (name || 'FF')
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase() || 'FF';
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${random}`;
}

function generateCouponCode(prefix = 'FF') {
  return `${prefix}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// ---------- Referral ----------
async function ensureUserHasReferralCode(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.referralCode) return user.referralCode;

  let code;
  let exists = true;
  while (exists) {
    code = generateReferralCode(user.name);
    exists = await User.exists({ referralCode: code });
  }
  user.referralCode = code;
  await user.save();

  // Also create a Referral record template (optional, for analytics)
  await Referral.create({
    referrer: userId,
    code,
    status: 'PENDING',
  });

  return code;
}

async function applyReferralOnSignup(newUserId, referralCode) {
  if (!referralCode) return null;

  const code = referralCode.toUpperCase().trim();
  const referrer = await User.findOne({ referralCode: code });
  if (!referrer || referrer._id.toString() === newUserId.toString()) {
    return null; // invalid or self-referral
  }

  // Mark the referee
  await User.findByIdAndUpdate(newUserId, { referredBy: referrer._id });

  // Create / update referral record
  let referral = await Referral.findOne({ code, status: 'PENDING' });
  if (!referral) {
    referral = await Referral.create({
      referrer: referrer._id,
      code,
      referee: newUserId,
      status: 'SIGNED_UP',
    });
  } else {
    referral.referee = newUserId;
    referral.status = 'SIGNED_UP';
    await referral.save();
  }

  // Create a first-order coupon for the new user
  const couponCode = generateCouponCode('WELCOME');
  await Coupon.create({
    code: couponCode,
    type: 'FIRST_ORDER',
    discountType: 'FLAT',
    discountValue: 50, // ₹50 off
    maxDiscountAmount: 50,
    minOrderValue: 150,
    firstOrderOnly: true,
    maxTotalUses: 1,
    maxUsesPerUser: 1,
    description: `Welcome gift via referral from ${referrer.name}`,
    referralCodeOwner: referrer._id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { referral, welcomeCoupon: couponCode };
}

async function processReferralRewardOnFirstOrder(orderId) {
  const order = await FpoOrder.findById(orderId).populate('consumer');
  if (!order || !order.consumer) return null;

  const consumer = order.consumer;
  if (consumer.hasCompletedFirstOrder) return null; // already processed

  // Mark first order
  await User.findByIdAndUpdate(consumer._id, { hasCompletedFirstOrder: true });

  if (!consumer.referredBy) return null;

  const referral = await Referral.findOne({
    referee: consumer._id,
    status: 'SIGNED_UP',
  });
  if (!referral) return null;

  // Give rewards
  const referrerRewardAmount = referral.referrerReward?.value || 50;
  const refereeRewardAmount = referral.refereeReward?.value || 50;

  // Credit referrer
  await creditWallet(
    referral.referrer,
    referrerRewardAmount,
    'REFERRAL_REWARD',
    `Referral reward for inviting ${consumer.name}`,
    { referral: referral._id, order: orderId }
  );

  // Credit referee (extra bonus on first order)
  await creditWallet(
    consumer._id,
    refereeRewardAmount,
    'REFERRAL_REWARD',
    'Welcome bonus for completing your first order',
    { referral: referral._id, order: orderId }
  );

  referral.status = 'REWARDED';
  referral.referrerRewardGiven = true;
  referral.refereeRewardGiven = true;
  referral.referrerRewardAmount = referrerRewardAmount;
  referral.refereeRewardAmount = refereeRewardAmount;
  referral.triggeringOrder = orderId;
  await referral.save();

  return referral;
}

// ---------- Wallet ----------
async function creditWallet(userId, amount, type, description, links = {}) {
  if (amount <= 0) return null;
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  user.walletBalance = (user.walletBalance || 0) + amount;
  await user.save();

  return WalletTransaction.create({
    user: userId,
    type,
    amount,
    balanceAfter: user.walletBalance,
    description,
    ...links,
  });
}

async function debitWallet(userId, amount, description, orderId = null) {
  if (amount <= 0) return null;
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if ((user.walletBalance || 0) < amount) {
    throw new Error('Insufficient wallet balance');
  }

  user.walletBalance -= amount;
  await user.save();

  return WalletTransaction.create({
    user: userId,
    type: 'DEBIT',
    amount,
    balanceAfter: user.walletBalance,
    description,
    order: orderId,
  });
}

// ---------- Coupon Validation ----------
async function validateAndApplyCoupon(code, userId, orderValue, produceTypes = [], city = null) {
  const coupon = await Coupon.findOne({
    code: code.toUpperCase().trim(),
    isActive: true,
  });

  if (!coupon) {
    return { valid: false, message: 'Invalid coupon code' };
  }

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    return { valid: false, message: 'Coupon not yet active' };
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { valid: false, message: 'Coupon has expired' };
  }
  if (coupon.maxTotalUses !== null && coupon.usedCount >= coupon.maxTotalUses) {
    return { valid: false, message: 'Coupon usage limit reached' };
  }

  // Per-user limit
  const userUsage = await FpoOrder.countDocuments({
    consumer: userId,
    couponCode: coupon.code,
  });
  if (userUsage >= coupon.maxUsesPerUser) {
    return { valid: false, message: 'You have already used this coupon' };
  }

  // First order only
  if (coupon.firstOrderOnly) {
    const user = await User.findById(userId);
    if (user?.hasCompletedFirstOrder) {
      return { valid: false, message: 'This coupon is only for first-time buyers' };
    }
  }

  if (orderValue < coupon.minOrderValue) {
    return {
      valid: false,
      message: `Minimum order value of ₹${coupon.minOrderValue} required`,
    };
  }

  // City filter
  if (coupon.allowedCities?.length && city) {
    if (!coupon.allowedCities.map((c) => c.toLowerCase()).includes(city.toLowerCase())) {
      return { valid: false, message: 'Coupon not valid in your city' };
    }
  }

  // Produce filter
  if (coupon.allowedProduceTypes?.length && produceTypes.length) {
    const match = produceTypes.some((p) =>
      coupon.allowedProduceTypes.map((t) => t.toLowerCase()).includes(p.toLowerCase())
    );
    if (!match) {
      return { valid: false, message: 'Coupon not valid for selected produce' };
    }
  }

  // Calculate discount
  let discount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discount = (orderValue * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
  } else {
    discount = Math.min(coupon.discountValue, orderValue);
  }

  return {
    valid: true,
    coupon,
    discount: Math.round(discount * 100) / 100,
    message: `₹${discount} discount applied`,
  };
}

async function incrementCouponUsage(code) {
  await Coupon.updateOne(
    { code: code.toUpperCase().trim() },
    { $inc: { usedCount: 1 } }
  );
}

// ---------- Bootstrap popular coupons ----------
async function seedDefaultCoupons() {
  const defaults = [
    {
      code: 'WELCOME50',
      type: 'FIRST_ORDER',
      discountType: 'FLAT',
      discountValue: 50,
      maxDiscountAmount: 50,
      minOrderValue: 199,
      firstOrderOnly: true,
      maxTotalUses: null,
      maxUsesPerUser: 1,
      description: '₹50 off on your first order',
    },
    {
      code: 'FRESH10',
      type: 'PERCENTAGE',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maxDiscountAmount: 100,
      minOrderValue: 299,
      maxTotalUses: null,
      maxUsesPerUser: 3,
      description: '10% off (max ₹100)',
    },
  ];

  for (const c of defaults) {
    const exists = await Coupon.findOne({ code: c.code });
    if (!exists) {
      await Coupon.create(c);
    }
  }
}

module.exports = {
  generateReferralCode,
  ensureUserHasReferralCode,
  applyReferralOnSignup,
  processReferralRewardOnFirstOrder,
  creditWallet,
  debitWallet,
  validateAndApplyCoupon,
  incrementCouponUsage,
  seedDefaultCoupons,
};
