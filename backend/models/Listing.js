const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    fpo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fpo',
      required: true,
      index: true,
    },
    produceType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'Custom'],
      required: true,
    },
    pricePerKg: {
      type: Number,
      required: true,
      min: 0,
    },
    availableQuantityKg: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderQtyKg: {
      type: Number,
      default: 1,
      min: 0.001,
    },
    description: {
      type: String,
      default: '',
    },
    images: [String],
    sourceBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
    },
    sourceIntakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
    },
    status: {
      type: String,
      enum: ['Draft', 'Published', 'Paused'],
      default: 'Draft',
      index: true,
    },

    // ===== GROWTH + GEO LAYER =====
    originLocation: {
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
    deliveryRadiusKm: {
      type: Number,
      default: 25,
      min: 1,
      max: 200,
    },
    qualityGuarantee: {
      type: Boolean,
      default: true,
    },
    harvestDate: {
      type: Date,
    },
    slug: {
      type: String,
      sparse: true,
      index: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    recentOrderCount7d: {
      type: Number,
      default: 0,
    },
    isTrending: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

listingSchema.index({ originLocation: '2dsphere' });
listingSchema.index({ status: 1, produceType: 1, isTrending: -1 });
listingSchema.index({ fpo: 1, status: 1 });

module.exports = mongoose.model('Listing', listingSchema);
