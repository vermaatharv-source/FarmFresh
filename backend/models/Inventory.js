const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    fpo: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Fpo', 
      required: true 
    },
    produceType: { type: String, required: true },
    grade: { 
      type: String, 
      enum: ['A', 'B', 'C', 'Custom'], 
      required: true 
    },
    totalQuantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    soldQuantity: { type: Number, default: 0 },
    minAlertThreshold: { type: Number, default: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Inventory', inventorySchema);