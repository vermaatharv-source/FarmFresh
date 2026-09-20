const mongoose = require('mongoose');

/**
 * Unified audit trail — who did what, when, from which account.
 * Covers farmer edits, grading, price changes, payouts, KYC, listings.
 */
const activityLogSchema = new mongoose.Schema(
  {
    fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, default: '' },
    actorName: { type: String, default: '' },

    action: {
      type: String,
      required: true,
      enum: [
        'FARMER_CREATE',
        'FARMER_UPDATE',
        'FARMER_IMPORT',
        'FARMER_VERIFY',
        'FARMER_STATUS',
        'INTAKE_CREATE',
        'GRADING_APPROVE',
        'GRADING_REJECT',
        'PRICE_CONFIG_CREATE',
        'PRICE_CONFIG_UPDATE',
        'LISTING_CREATE',
        'LISTING_PUBLISH',
        'LISTING_PAUSE',
        'PAYOUT_CREATE',
        'PAYOUT_COMPLETE',
        'KYC_UPLOAD',
        'KYC_STATUS_CHANGE',
        'STAFF_ADD',
        'STAFF_REMOVE',
        'ORDER_STATUS',
        'PROFILE_UPDATE',
        'BANK_DETAILS_VIEW',
        'KYC_DOCUMENT_VIEW',
        'OTHER',
      ],
    },
    entityType: { type: String, default: '' }, // Farmer, Batch, Payout, etc.
    entityId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

activityLogSchema.index({ fpo: 1, createdAt: -1 });
activityLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
