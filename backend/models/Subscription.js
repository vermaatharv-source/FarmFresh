const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    consumer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ['FPO', 'DIRECT'],
      default: 'FPO',
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },
    produce: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Produce',
    },
    produceName: {
      type: String,
      required: true,
    },
    grade: {
      type: String,
      default: 'A',
    },
    quantityKg: {
      type: Number,
      required: true,
      min: 0.5,
    },
    frequency: {
      type: String,
      enum: ['Weekly', 'BiWeekly', 'Monthly'],
      default: 'Weekly',
    },
    deliveryDay: {
      type: String,
      enum: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      default: 'Monday',
    },
    deliverySlot: {
      type: String,
      default: 'Morning (6:00 AM - 9:00 AM)',
    },
    deliveryAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      streetAddress: { type: String, required: true },
      landmark: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, default: '' },
      pincode: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      enum: ['CARD', 'UPI', 'COD'],
      default: 'CARD',
    },
    basePrice: {
      type: Number,
      required: true,
    },
    discountPercent: {
      type: Number,
      default: 5,
    },
    finalPricePerDelivery: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Paused', 'Cancelled'],
      default: 'Active',
      index: true,
    },
    nextDeliveryDate: {
      type: Date,
      required: true,
    },
    lastDeliveredDate: {
      type: Date,
    },
    deliveriesCompleted: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
