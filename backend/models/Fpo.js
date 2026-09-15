const mongoose = require('mongoose');

const fpoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    registrationNumber: { type: String, required: true, unique: true },
    kycStatus: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending',
    },
    kycDocuments: [{ type: String }],
    contactDetails: {
      // FIX: phone/address are collected later during KYC/profile completion,
      // not always available at signup time — making them required caused
      // Fpo.create() to throw a ValidationError during registration.
      phone: { type: String, default: '' },
      email: { type: String, required: true },
      address: { type: String, default: '' },
      district: { type: String },
      state: { type: String },
      pincode: { type: String },
    },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // FIX: one FPO per admin — prevents duplicate FPO docs for the same user
    },
    staff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Fpo', fpoSchema);
