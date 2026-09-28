const mongoose = require('mongoose');

// One row per consumer payment. It records the split:
//   FPO account      <- fpoAmount
//   Platform account <- platformFee
const paymentTransactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'FpoOrder', required: true, index: true },
  fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', required: true, index: true },
  consumer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paymentMethod: { type: String, default: 'CARD' },
  orderAmount: { type: Number, required: true, min: 0 },
  platformFeePercent: { type: Number, default: 30 },
  platformFee: { type: Number, required: true, min: 0 },
  fpoAmount: { type: Number, required: true, min: 0 },
  totalCharged: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['Success', 'Refunded'], default: 'Success' },
  // Where each part of the money was routed.
  splits: [{
    beneficiary: { type: String, enum: ['FPO', 'PLATFORM'], required: true },
    fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo' },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Credited', 'Reversed'], default: 'Credited' },
  }],
  refundTransactionId: { type: String },
  refundedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);