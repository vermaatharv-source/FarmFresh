const mongoose = require('mongoose');

/**
 * High-impact Coupon & Incentive engine
 * Supports: first-order, referral, percentage/flat, usage limits, per-user limits, geo, produce filters
 */
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['FIRST_ORDER', 'REFERRAL', 'PERCENTAGE', 'FLAT', 'FREE_DELIVERY', 'PRODUCE_SPECIFIC'],
      required: true,
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FLAT'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null, // e.g. max ₹100 off even on 20% coupon
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    // Who can use it
    applicableRoles: {
      type: [String],
      default: ['consumer'],
    },
    // First-order only?
    firstOrderOnly: {
      type: Boolean,
      default: false,
    },
    // Referral linkage
    referralCodeOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Limits
    maxTotalUses: {
      type: Number,
      default: null, // null = unlimited
    },
    maxUsesPerUser: {
      type: Number,
      default: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    // Validity
    startsAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Optional filters
    allowedCities: [String],
    allowedProduceTypes: [String],
    // Metadata
    description: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Fast lookup
couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
