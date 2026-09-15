const mongoose = require('mongoose');

// Orders placed by consumers against an FPO Listing (separate from the
// farmer-direct Order model, which is tied to the Produce model instead).
const fpoOrderSchema = new mongoose.Schema(
  {
    fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    consumer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quantityKg: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ['Placed', 'Packed', 'Dispatched', 'Delivered', 'Cancelled'],
      default: 'Placed',
    },
    cancelReason: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FpoOrder', fpoOrderSchema);
