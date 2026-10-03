const mongoose = require('mongoose');

/**
 * Full Referral system – tracks invite → signup → first order → reward
 */
const referralSchema = new mongoose.Schema(
  {
    // The person who shared the code
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Unique code for this referrer (also stored on User for convenience)
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    // Who used the code
    referee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SIGNED_UP', 'FIRST_ORDER_COMPLETED', 'REWARDED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    // Rewards configuration at time of creation
    referrerReward: {
      type: {
        type: String,
        enum: ['CREDIT', 'COUPON', 'PERCENTAGE'],
        default: 'CREDIT',
      },
      value: { type: Number, default: 50 }, // ₹50 credit
    },
    refereeReward: {
      type: {
        type: String,
        enum: ['CREDIT', 'COUPON', 'PERCENTAGE'],
        default: 'CREDIT',
      },
      value: { type: Number, default: 50 },
    },
    // Actual rewards given
    referrerRewardGiven: { type: Boolean, default: false },
    refereeRewardGiven: { type: Boolean, default: false },
    referrerRewardAmount: { type: Number, default: 0 },
    refereeRewardAmount: { type: Number, default: 0 },
    // Linked order that triggered the reward
    triggeringOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FpoOrder',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    },
  },
  { timestamps: true }
);

// One active referral code per user
referralSchema.index({ referrer: 1, status: 1 });

module.exports = mongoose.model('Referral', referralSchema);
