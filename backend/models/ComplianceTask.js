const mongoose = require('mongoose');

const complianceTaskSchema = new mongoose.Schema({
  fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  category: { type: String, enum: ['STATUTORY', 'FINANCE', 'GOVERNANCE', 'KYC', 'OPERATIONS'], default: 'OPERATIONS' },
  dueDate: { type: Date },
  status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE'], default: 'PENDING' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  completedAt: { type: Date },
}, { timestamps: true });

complianceTaskSchema.index({ fpo: 1, status: 1, dueDate: 1 });
module.exports = mongoose.model('ComplianceTask', complianceTaskSchema);
