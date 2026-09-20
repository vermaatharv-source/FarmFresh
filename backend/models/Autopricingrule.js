const mongoose = require('mongoose');

// One rule per (fpo, cropName). While isEnabled, the crop's active
// GradePriceConfig is recomputed automatically every time mandi prices are
// synced — the FPO no longer needs to hit "Save New Pricing" by hand.
const autoPricingRuleSchema = new mongoose.Schema(
  {
    fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', required: true, index: true },
    cropName: { type: String, required: true, trim: true },
    gradeADiscountPct: { type: Number, default: 0, min: 0, max: 100 },
    gradeBDiscountPct: { type: Number, default: 15, min: 0, max: 100 },
    gradeCDiscountPct: { type: Number, default: 30, min: 0, max: 100 },
    isEnabled: { type: Boolean, default: true },
    state: { type: String, trim: true },   // optional: pin to one mandi state
    market: { type: String, trim: true },  // optional: pin to one mandi market
    lastAppliedAt: { type: Date },
    lastAppliedModalPrice: { type: Number }, // raw ₹/quintal used last run, to skip no-op re-applies
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

autoPricingRuleSchema.index({ fpo: 1, cropName: 1 }, { unique: true });

module.exports = mongoose.model('AutoPricingRule', autoPricingRuleSchema);