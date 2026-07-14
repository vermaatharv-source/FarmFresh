const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  consumerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  produceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce', required: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantity: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['placed', 'confirmed', 'delivered'], default: 'placed' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);