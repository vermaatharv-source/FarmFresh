const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  consumerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  produceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce', required: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantity: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['placed', 'confirmed', 'delivered', 'cancelled', 'refunded', 'Placed', 'Confirmed', 'Delivered', 'Cancelled', 'Refunded'], 
    default: 'placed' 
  },
  cancelReason: { type: String, default: '' },
  returnReason: { type: String, default: '' },
  refundStatus: { type: String, enum: ['NotRequired', 'Pending', 'Processed', 'Failed'], default: 'NotRequired' },
  refundTransactionId: { type: String, default: '' },
  deliveryAddress: {
    fullName: { type: String },
    phone: { type: String },
    streetAddress: { type: String },
    landmark: { type: String, default: '' },
    city: { type: String },
    state: { type: String },
    pincode: { type: String }
  },
  deliverySlot: { type: String, default: 'Standard Delivery' },
  paymentMethod: { type: String, default: 'CARD' },
  discountAmount: { type: Number, default: 0 },
  couponCode: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);