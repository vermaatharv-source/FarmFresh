const mongoose = require('mongoose');
const Fpo = require('../models/Fpo');
const { logActivity } = require('../utils/activityLogger');

// Records every successful state-changing request made by an FPO admin, FPO
// staff member or the government admin, using the ActivityLog action names.
// Farmer create / update / Excel import already write richer entries in
// controllers/farmerHandlers.js, so they are intentionally not listed here.
const str = (v) => (v === undefined || v === null ? '' : String(v));

const RULES = {
  'POST /api/fpo/register': { action: 'PROFILE_UPDATE', type: 'FPO', summary: () => 'Registered the FPO profile' },
  'PATCH /api/fpo/profile': { action: 'PROFILE_UPDATE', type: 'FPO', summary: () => 'Updated the FPO profile' },
  'POST /api/fpo/kyc': { action: 'KYC_UPLOAD', type: 'FPO', summary: () => 'Uploaded KYC documents' },
  'PATCH /api/fpo/kyc/:fpoId/status': {
    action: 'KYC_STATUS_CHANGE',
    type: 'FPO',
    summary: (req) => `Set KYC status to ${str(req.body.status)}${req.body.reason ? ` (${str(req.body.reason)})` : ''}`,
  },
  'POST /api/fpo/staff': { action: 'STAFF_ADD', type: 'Staff', summary: (req) => `Added staff member ${str(req.body.name)}` },
  'PATCH /api/fpo/staff/:staffId': { action: 'OTHER', type: 'Staff', summary: () => 'Updated a staff member' },
  'DELETE /api/fpo/staff/:staffId': { action: 'STAFF_REMOVE', type: 'Staff', summary: () => 'Removed a staff member' },
  'POST /api/fpo/farmers/import-csv': { action: 'FARMER_IMPORT', type: 'Farmer', summary: () => 'Imported farmers from a CSV file' },
  'PATCH /api/fpo/farmers/:farmerId/verify': { action: 'FARMER_VERIFY', type: 'Farmer', summary: () => 'Changed a farmer\'s verification status' },
  'PATCH /api/fpo/farmers/:farmerId/status': { action: 'FARMER_STATUS', type: 'Farmer', summary: () => 'Changed a farmer\'s active status' },
  'POST /api/fpo/batches/intake': { action: 'INTAKE_CREATE', type: 'Batch', summary: (req) => `Recorded produce intake${req.body.produceType ? ` (${str(req.body.produceType)})` : ''}` },
  'PATCH /api/fpo/batches/:batchId/grade': {
    action: (req) => (req.body.status === 'Rejected' ? 'GRADING_REJECT' : 'GRADING_APPROVE'),
    type: 'Batch',
    summary: (req) => `Graded a batch (${req.body.status || 'Approved'})`,
  },
  'POST /api/fpo/batches/:batchId/payout': { action: 'PAYOUT_CREATE', type: 'Payout', summary: () => 'Recorded an automatic grade-based farmer payout' },
  'POST /api/fpo/payouts': { action: 'PAYOUT_CREATE', type: 'Payout', summary: () => 'Created a farmer payout' },
  'PATCH /api/fpo/payouts/:payoutId/complete': { action: 'PAYOUT_COMPLETE', type: 'Payout', summary: () => 'Marked a payout as completed' },
  'POST /api/grade-prices': { action: 'PRICE_CONFIG_CREATE', type: 'Pricing', summary: (req) => `Configured grade prices${req.body.cropName ? ` for ${str(req.body.cropName)}` : ''}` },
  'PUT /api/grade-prices/:id': { action: 'PRICE_CONFIG_UPDATE', type: 'Pricing', summary: () => 'Updated grade prices' },
  'PATCH /api/grade-prices/:id/deactivate': { action: 'PRICE_CONFIG_UPDATE', type: 'Pricing', summary: () => 'Deactivated a grade price configuration' },
  'POST /api/listings': { action: 'LISTING_CREATE', type: 'Listing', summary: () => 'Created a listing' },
  'PATCH /api/listings/:id/status': {
    action: (req) => (req.body.status === 'Published' ? 'LISTING_PUBLISH' : 'LISTING_PAUSE'),
    type: 'Listing',
    summary: (req) => `Set listing status to ${str(req.body.status)}`,
  },
  'PUT /api/listings/:id': { action: 'OTHER', type: 'Listing', summary: () => 'Updated a listing' },
  'DELETE /api/listings/:id': { action: 'OTHER', type: 'Listing', summary: () => 'Deleted a listing' },
  'PATCH /api/fpo-orders/:id/status': { action: 'ORDER_STATUS', type: 'Order', summary: (req) => `Updated an order status${req.body.status ? ` to ${str(req.body.status)}` : ''}` },
  'PATCH /api/fpo-orders/:id/cancel': { action: 'ORDER_STATUS', type: 'Order', summary: () => 'Cancelled an order' },
  'PATCH /api/fpo-orders/:id/refund': { action: 'ORDER_STATUS', type: 'Order', summary: () => 'Processed an order refund' },
};

// Never list the names of sensitive fields as "changed".
const SENSITIVE = /pass|aadhaar|account|bank|token|otp|secret/i;

module.exports.auditMiddleware = (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (req.method === 'GET' || res.statusCode >= 400) return;
      const role = req.user && req.user.role;
      if (!['fpo_admin', 'fpo_staff', 'admin'].includes(role)) return;

      const routePath = ((req.baseUrl || '') + ((req.route && req.route.path) || '')).replace(/\/$/, '');
      const rule = RULES[`${req.method} ${routePath}`];
      if (!rule) return;

      // The government admin acts on someone else's FPO (:fpoId); everyone else on their own.
      const uid = req.user.id || req.user._id;
      let fpoId;
      if (role === 'admin') {
        fpoId = req.params.fpoId;
      } else {
        const fpo = await Fpo.findOne({ $or: [{ adminUser: uid }, { staff: uid }] }).select('_id');
        fpoId = fpo && fpo._id;
      }
      if (!fpoId) return;

      const params = Object.values(req.params || {});
      const last = params.length ? String(params[params.length - 1]) : '';
      const action = typeof rule.action === 'function' ? rule.action(req) : rule.action;

      await logActivity({
        req,
        fpoId,
        action,
        entityType: rule.type,
        entityId: mongoose.isValidObjectId(last) ? last : undefined,
        summary: rule.summary(req),
        meta: { changedFields: Object.keys(req.body || {}).filter((k) => !SENSITIVE.test(k)) },
      });
    } catch (err) {
      console.error('[audit] could not record activity:', err.message);
    }
  });
  next();
};
