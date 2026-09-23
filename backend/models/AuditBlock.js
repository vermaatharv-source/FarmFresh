const mongoose = require('mongoose');

/**
 * Tamper-evident audit blockchain.
 *
 * This is an internal hash-chain ledger stored in MongoDB. Each block commits
 * to the previous block's hash plus the event payload. It provides integrity
 * verification and auditability inside FarmFresh; it is NOT a decentralized
 * public blockchain.
 */
const auditBlockSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true, unique: true, index: true },
    previousHash: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, default: '' },
    fpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Fpo', index: true },
    action: { type: String, required: true },
    entityType: { type: String, default: '' },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    payloadHash: { type: String, required: true },
    hash: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditBlock', auditBlockSchema);
