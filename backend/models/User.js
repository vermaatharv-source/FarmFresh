const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home',
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    streetAddress: {
      type: String,
      required: true,
      trim: true,
    },
    landmark: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    // Geo for precise delivery
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: undefined,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    consentAcceptedAt: { type: Date },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      set: (v) => v.toLowerCase().replace(/\s+/g, '_'),
      enum: ['consumer', 'admin', 'fpo_admin', 'fpo_staff'],
    },
    // Legacy text location (kept for backward compatibility)
    location: {
      type: String,
      required: true,
      trim: true,
    },
    // Primary geo point (used for "near me")
    geoLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: undefined,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },
    addresses: [addressSchema],

    // ===== GROWTH LAYER =====
    // Unique referral code for this user
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    // Who referred this user
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Wallet balance (store credit)
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    // First order completed? (for first-order coupons)
    hasCompletedFirstOrder: {
      type: Boolean,
      default: false,
    },
    // Marketing preferences
    marketingOptIn: {
      type: Boolean,
      default: true,
    },
    preferredLanguage: {
      type: String,
      default: 'en',
    },
  },
  { timestamps: true }
);

// Geospatial index for "near me" queries
userSchema.index({ geoLocation: '2dsphere' });
userSchema.index({ 'addresses.location': '2dsphere' });

module.exports = mongoose.model('User', userSchema);
