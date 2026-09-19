const mongoose = require('mongoose');
const { maskAadhaar } = require('../utils/privacy');

const farmerSchema = new mongoose.Schema(
  {
    fpo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fpo',
      required: true
    },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    // Only the last 4 digits are ever stored or returned ("XXXX XXXX 1234").
    // The setter masks on every write path (create, insertMany, updates); the
    // getter also masks values saved in full before this change.
    aadhaarNumber: { type: String, set: maskAadhaar, get: maskAadhaar },
    address: { type: String },
    bankDetails: {
      accountNumber: { type: String },
      ifscCode: { type: String },
      bankName: { type: String },
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

module.exports = mongoose.model('Farmer', farmerSchema);