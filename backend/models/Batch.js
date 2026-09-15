const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, unique: true },
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
    produceType: { type: String, required: true },
    rawQuantityKg: { type: Number, required: true },
    harvestDate: { type: Date },
    collectionDate: { type: Date, default: Date.now },
    grading: {
      gradeA_Kg: { type: Number, default: 0 },
      gradeB_Kg: { type: Number, default: 0 },
      gradeC_Kg: { type: Number, default: 0 },
      qualityScore: { type: Number, min: 0, max: 100 },
      qualityImages: [{ type: String }],
      status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
      },
    },
    // NEW: every grading action appends here instead of overwriting `grading`,
    // so there's an actual audit trail of who graded what and when.
    gradingHistory: [
      {
        gradeA_Kg: { type: Number, default: 0 },
        gradeB_Kg: { type: Number, default: 0 },
        gradeC_Kg: { type: Number, default: 0 },
        qualityScore: { type: Number },
        qualityImages: [{ type: String }],
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected'] },
        gradedAt: { type: Date, default: Date.now },
      },
    ],
    qrCodeUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Batch', batchSchema);
