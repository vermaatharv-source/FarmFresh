const mongoose = require('mongoose');
const { maskAadhaar, encryptBankField, decryptBankField, maskAccountNumber } = require('../utils/privacy');

const farmerSchema = new mongoose.Schema(
  {
    fpo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fpo',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },

    // Only last 4 digits stored/returned
    aadhaarNumber: { type: String, set: maskAadhaar, get: maskAadhaar },

    // Location (govt-format)
    village: { type: String, default: '', trim: true },
    block: { type: String, default: '', trim: true },
    district: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },

    // Land & crops
    landHoldingAcres: { type: Number, default: 0, min: 0 },
    cropsGrown: [{ type: String, trim: true }],

    // Demographics (scheme reporting)
    gender: {
      type: String,
      enum: ['', 'Male', 'Female', 'Other'],
      default: '',
    },
    category: {
      type: String,
      enum: ['', 'General', 'OBC', 'SC', 'ST', 'Other'],
      default: '',
    },

    // Membership
    memberId: { type: String, default: '', trim: true },
    joiningDate: { type: Date },
    isShareholder: { type: Boolean, default: true },

    // Bank — encrypted at rest via setters
    bankDetails: {
      accountNumber: {
        type: String,
        set: encryptBankField,
        get: maskAccountNumber, // API output is always masked (XXXXXX1234)
      },
      ifscCode: { type: String, default: '', trim: true, uppercase: true },
      bankName: { type: String, default: '', trim: true },
    },

    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    totalEarnedLifetime: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

farmerSchema.index({ fpo: 1, phone: 1 });
farmerSchema.index({ fpo: 1, memberId: 1 });

// The only way to read the full account number. Used by the audited,
// FPO-admin-only "view bank details" endpoint.
farmerSchema.methods.getBankAccountNumber = function () {
  return decryptBankField(this.get('bankDetails.accountNumber', null, { getters: false })) || '';
};

module.exports = mongoose.model('Farmer', farmerSchema);
