const mongoose = require('mongoose');

/**
 * Simple wallet / store credit system for referral rewards, refunds, promotions
 */
const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT', 'REFUND', 'REFERRAL_REWARD', 'PROMO', 'ADJUSTMENT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    // Link to source
    referral: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'FpoOrder' },
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // admin adjustment
  },
  { timestamps: true }
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
