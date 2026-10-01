const mongoose = require('mongoose');

const procurementPlanSchema = new mongoose.Schema({
  fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', required: true, index: true },
  produceType: { type: String, required: true, trim: true },
  requiredQuantityKg: { type: Number, required: true, min: 0.001 },
  targetPricePerKg: { type: Number, min: 0, default: 0 },
  requiredBy: { type: Date, required: true },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'], default: 'OPEN' },
}, { timestamps: true });

procurementPlanSchema.index({ fpo: 1, status: 1, requiredBy: 1 });
module.exports = mongoose.model('ProcurementPlan', procurementPlanSchema);
