const path = require('path');
const fs = require('fs');
const Fpo = require('../models/Fpo');
const Farmer = require('../models/Farmer');
const ActivityLog = require('../models/ActivityLog');
const Batch = require('../models/Batch');
const FpoOrder = require('../models/FpoOrder');
const Payout = require('../models/Payout');
const { logActivity } = require('../utils/activityLogger');

// KYC documents are private. They are only ever streamed through these
// endpoints, after an authorisation check:
//   - the FPO admin can open its own documents
//   - the government admin can open any FPO's documents (every view is audited)
const { UPLOADS_DIR, PRIVATE_DIR } = require('../config/storagePaths');
const DIRS = [PRIVATE_DIR, UPLOADS_DIR]; // second entry kept for any legacy public-path references

// Only the file name is used, so a stored value can never point outside these folders.
function resolveDocument(stored) {
  const name = path.basename(String(stored || '').replace(/\\/g, '/'));
  if (!name || name.startsWith('.')) return null;
  for (const dir of DIRS) {
    const candidate = path.join(dir, name);
    if (candidate.startsWith(dir) && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function sendDocument(res, stored) {
  const file = resolveDocument(stored);
  if (!file) return res.status(404).json({ message: 'Document file not found on the server.' });
  res.set({
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `inline; filename="kyc-document${path.extname(file)}"`,
  });
  return res.sendFile(file, { dotfiles: 'deny' });
}

const docAt = (fpo, indexParam) => {
  const i = Number.parseInt(indexParam, 10);
  return Number.isInteger(i) && i >= 0 ? (fpo.kycDocuments || [])[i] : undefined;
};

// GET /api/fpo/kyc/documents/:index  (FPO admin: own documents)
exports.ownDocument = async (req, res) => {
  try {
    const fpo = await Fpo.findOne({ adminUser: req.user._id || req.user.id }).select('kycDocuments');
    if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    const stored = docAt(fpo, req.params.index);
    if (!stored) return res.status(404).json({ message: 'Document not found.' });
    sendDocument(res, stored);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET /api/fpo/admin/fpos/:fpoId  (government admin: full review record)
exports.adminFpoDetail = async (req, res) => {
  try {
    const fpo = await Fpo.findById(req.params.fpoId).populate('adminUser', 'name email phone');
    if (!fpo) return res.status(404).json({ message: 'FPO not found.' });

    const [farmerCount, recentActivity] = await Promise.all([
      Farmer.countDocuments({ fpo: fpo._id }),
      ActivityLog.find({ fpo: fpo._id }).sort({ createdAt: -1 }).limit(15).select('action actorName actorRole summary createdAt'),
    ]);

    res.json({
      _id: fpo._id,
      name: fpo.name,
      registrationNumber: fpo.registrationNumber,
      registrationType: fpo.registrationType,
      dateOfIncorporation: fpo.dateOfIncorporation,
      pan: fpo.pan,
      gstin: fpo.gstin,
      fssaiLicense: fpo.fssaiLicense,
      udyamNumber: fpo.udyamNumber,
      cbboName: fpo.cbboName,
      schemeName: fpo.schemeName,
      shareholderFarmerCount: fpo.shareholderFarmerCount,
      managerName: fpo.managerName,
      managerContact: fpo.managerContact,
      contactDetails: fpo.contactDetails,
      adminUser: fpo.adminUser,
      kycStatus: fpo.kycStatus,
      kycRejectionReason: fpo.kycRejectionReason,
      createdAt: fpo.createdAt,
      farmerCount,
      // File paths never leave the server; the reviewer opens documents by index.
      documents: (fpo.kycDocuments || []).map((stored, index) => ({
        index,
        label: `Document ${index + 1}`,
        type: path.extname(String(stored)).replace('.', '').toUpperCase() || 'FILE',
        available: Boolean(resolveDocument(stored)),
      })),
      recentActivity,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET /api/fpo/admin/fpos/:fpoId/documents/:index  (government admin, audited)
exports.adminDocument = async (req, res) => {
  try {
    const fpo = await Fpo.findById(req.params.fpoId).select('name kycDocuments');
    if (!fpo) return res.status(404).json({ message: 'FPO not found.' });
    const stored = docAt(fpo, req.params.index);
    if (!stored) return res.status(404).json({ message: 'Document not found.' });

    await logActivity({
      req,
      fpoId: fpo._id,
      action: 'KYC_DOCUMENT_VIEW',
      entityType: 'FPO',
      summary: `Authority viewed KYC document ${Number(req.params.index) + 1} of ${fpo.name}`,
    });
    sendDocument(res, stored);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET /api/fpo/admin/summary  (government admin)
// Platform-wide totals for the authority overview. Only counts and sums are
// returned. No individual farmer, order or payment record leaves this endpoint.
exports.adminSummary = async (req, res) => {
  try {
    const [genderRows, landRows, batchRows, salesRows, payoutRows, activeCount] = await Promise.all([
      Farmer.aggregate([{ $group: { _id: '$gender', n: { $sum: 1 } } }]),
      Farmer.aggregate([{ $group: { _id: null, acres: { $sum: '$landHoldingAcres' } } }]),
      Batch.aggregate([{ $group: { _id: null, kg: { $sum: '$rawQuantityKg' }, count: { $sum: 1 } } }]),
      FpoOrder.aggregate([
        { $match: { status: { $nin: ['Cancelled', 'Rejected', 'Refunded'] } } },
        { $group: { _id: null, value: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
      ]),
      Payout.aggregate([
        { $match: { status: 'Completed' } },
        { $group: { _id: null, paid: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Farmer.countDocuments({ isActive: true }),
    ]);

    const total = genderRows.reduce((sum, r) => sum + r.n, 0);
    const women = (genderRows.find((r) => r._id === 'Female') || {}).n || 0;
    const genderRecorded = genderRows.filter((r) => r._id).reduce((sum, r) => sum + r.n, 0);
    const first = (rows, key) => (rows[0] && rows[0][key]) || 0;

    res.json({
      farmers: { total, active: activeCount, women, genderRecorded, landAcres: first(landRows, 'acres') },
      batches: { count: first(batchRows, 'count'), kg: first(batchRows, 'kg') },
      sales: { value: first(salesRows, 'value'), orders: first(salesRows, 'orders') },
      payouts: { paid: first(payoutRows, 'paid'), count: first(payoutRows, 'count') },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};