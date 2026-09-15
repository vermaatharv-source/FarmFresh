const mongoose = require('mongoose');

const farmerSchema = new mongoose.Schema(
  {
    fpo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Fpo', 
      required: true 
    },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    aadhaarNumber: { type: String },
    address: { type: String },
    bankDetails: {
      accountNumber: { type: String },
      ifscCode: { type: String },
      bankName: { type: String },
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Farmer', farmerSchema);