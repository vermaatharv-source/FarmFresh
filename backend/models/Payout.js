const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema(
  {
    fpo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Fpo', 
      required: true 
    },
    farmer: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Farmer', 
      required: true 
    },
    batch: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Batch' 
    },
    amount: { type: Number, required: true },
    status: { 
      type: String, 
      enum: ['Pending', 'Completed', 'Failed'], 
      default: 'Pending' 
    },
    transactionId: { type: String },
    paymentDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payout', payoutSchema);