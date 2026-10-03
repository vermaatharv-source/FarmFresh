const mongoose = require('mongoose');

const fpoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    registrationNumber: { type: String, required: true, unique: true, trim: true },
    registrationType: {
      type: String,
      enum: ['', 'Producer Company', 'Cooperative Society', 'Other'],
      default: '',
    },
    dateOfIncorporation: { type: Date },
    pan: { type: String, default: '', trim: true, uppercase: true },
    gstin: { type: String, default: '', trim: true, uppercase: true },
    fssaiLicense: { type: String, default: '', trim: true },
    udyamNumber: { type: String, default: '', trim: true },
    schemeName: { type: String, default: '', trim: true },
    shareholderFarmerCount: { type: Number, default: 0, min: 0 },
    cbboName: { type: String, default: '' },
    managerName: { type: String, default: '' },
    managerContact: { type: String, default: '' },
    kycStatus: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending',
    },
    kycRejectionReason: { type: String, default: '' },
    kycDocuments: [{ type: String }],
    contactDetails: {
      phone: { type: String, default: '' },
      email: { type: String, required: true },
      address: { type: String, default: '' },
      district: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    creditLineAvailable: { type: Number, default: 0, min: 0 },
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ===== GEO + DELIVERY =====
    geoLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: undefined,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },
    defaultDeliveryRadiusKm: {
      type: Number,
      default: 30,
      min: 5,
      max: 150,
    },
    serviceablePincodes: [String],
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    shortBio: { type: String, default: '', maxlength: 300 },
    averageRating: { type: Number, default: 0 },
    totalOrdersFulfilled: { type: Number, default: 0 },
  },
  { timestamps: true }
);

fpoSchema.index({ geoLocation: '2dsphere' });
fpoSchema.index({ 'contactDetails.district': 1, 'contactDetails.state': 1 });

module.exports = mongoose.model('Fpo', fpoSchema);
