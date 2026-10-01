const mongoose = require('mongoose');

const buyerDemandSchema = new mongoose.Schema({
  fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', required: true, index: true },
  buyerName: { type: String, required: true, trim: true, maxlength: 160 },
  buyerType: { type: String, enum: ['RESTAURANT', 'KIRANA', 'WHOLESALER', 'PROCESSOR', 'INSTITUTION', 'OTHER'], default: 'OTHER' },
  produceType: { type: String, required: true, trim: true },
  quantityKg: { type: Number, required: true, min: 0.001 },
  targetPricePerKg: { type: Number, min: 0, default: 0 },
  deliveryDate: { type: Date, required: true },
  deliveryLocation: { type: String, trim: true, maxlength: 300, default: '' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['OPEN', 'MATCHED', 'FULFILLED', 'CANCELLED'], default: 'OPEN' },
}, { timestamps: true });

buyerDemandSchema.index({ fpo: 1, status: 1, deliveryDate: 1 });
module.exports = mongoose.model('BuyerDemand', buyerDemandSchema);
