const mongoose = require('mongoose');

const logisticsShipmentSchema = new mongoose.Schema({
  fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'FpoOrder', index: true },
  buyerDemand: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyerDemand', index: true },
  vehicleNumber: { type: String, trim: true, maxlength: 40, default: '' },
  driverName: { type: String, trim: true, maxlength: 120, default: '' },
  driverPhone: { type: String, trim: true, maxlength: 20, default: '' },
  origin: { type: String, trim: true, maxlength: 300, default: '' },
  destination: { type: String, trim: true, maxlength: 300, default: '' },
  quantityKg: { type: Number, required: true, min: 0.001 },
  transportCost: { type: Number, min: 0, default: 0 },
  pickupAt: { type: Date },
  eta: { type: Date },
  deliveredAt: { type: Date },
  status: { type: String, enum: ['PLANNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'], default: 'PLANNED' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true });

logisticsShipmentSchema.index({ fpo: 1, status: 1, eta: 1 });
module.exports = mongoose.model('LogisticsShipment', logisticsShipmentSchema);
