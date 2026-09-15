const mongoose = require('mongoose');

// A public product listing sourced from the FPO's graded Inventory.
// This is the link between "Inventory" and "Product Listings" that
// didn't exist before — publishing a listing reserves that quantity
// out of Inventory so it can't be double-sold.
const listingSchema = new mongoose.Schema(
  {
    fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', required: true },
    produceType: { type: String, required: true },
    grade: { type: String, enum: ['A', 'B', 'C', 'Custom'], required: true },
    pricePerKg: { type: Number, required: true },
    availableQuantityKg: { type: Number, required: true, default: 0 },
    minOrderQtyKg: { type: Number, default: 1 },
    description: { type: String, default: '' },
    images: [{ type: String }],
    status: { type: String, enum: ['Draft', 'Published', 'Paused'], default: 'Draft' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Listing', listingSchema);
