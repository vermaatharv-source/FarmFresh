const mongoose = require('mongoose');

// Tracks every change to Inventory so "stock movement / history" is queryable
// instead of just a running total on the Inventory document.
const stockMovementSchema = new mongoose.Schema(
  {
    fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', required: true },
    produceType: { type: String, required: true },
    grade: { type: String, required: true },
    type: {
      type: String,
      enum: ['Intake', 'Reserved', 'Released', 'Sold', 'Cancelled', 'Adjustment'],
      required: true,
    },
    quantityKg: { type: Number, required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'FpoOrder' },
    note: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockMovement', stockMovementSchema);
