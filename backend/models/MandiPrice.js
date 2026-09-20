const mongoose = require('mongoose');

const mandiPriceSchema = new mongoose.Schema(
  {
    commodityName: { type: String, required: true, index: true },
    state: { type: String, index: true },
    district: { type: String },
    market: { type: String, index: true },
    variety: { type: String },
    minPrice: { type: Number },
    modalPrice: { type: Number },
    maxPrice: { type: Number },
    source: { type: String, default: 'Agmarknet/eNAM' },
    date: { type: Date, required: true, index: true },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

mandiPriceSchema.index({ commodityName: 1, state: 1, market: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MandiPrice', mandiPriceSchema);