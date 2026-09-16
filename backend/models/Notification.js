const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', required: false, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    type: {
      type: String,
      enum: [
        'NewFarmer',
        'NewIntake',
        'GradingPending',
        'NewOrder',
        'LowInventory',
        'PayoutUpdate',
        'OrderPlaced',
        'OrderAccepted',
        'OrderPacked',
        'OrderDispatched',
        'OrderDelivered',
        'OrderCancelled',
        'ReturnRequested',
        'RefundProcessed',
        'BackInStock',
        'PriceDrop',
        'System',
      ],
      required: true,
    },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
