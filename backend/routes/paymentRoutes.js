const express = require('express');
const mongoose = require('mongoose');
const PaymentTransaction = require('../models/PaymentTransaction');
const Payout = require('../models/Payout');
const Fpo = require('../models/Fpo');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { buildCashFlow, buildBankPack } = require('../services/cashFlowService');

const router = express.Router();

// Platform/admin view. This is intentionally separate from the FPO endpoint.
router.get('/admin/platform-revenue', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const [t] = await PaymentTransaction.aggregate([
      { $match: { status: 'Success' } },
      { $group: { _id: null, platformFee: { $sum: '$platformFee' }, fpoAmount: { $sum: '$fpoAmount' }, orderAmount: { $sum: '$orderAmount' }, count: { $sum: 1 } } },
    ]);
    const recent = await PaymentTransaction.find().sort({ createdAt: -1 }).limit(20)
      .populate('fpo', 'name').select('transactionId fpo orderAmount platformFee fpoAmount totalCharged status createdAt');
    res.json({ totals: t || { platformFee: 0, fpoAmount: 0, orderAmount: 0, count: 0 }, recent });
  } catch (e) {
    res.status(500).json({ message: 'Unable to load platform revenue.' });
  }
});

// FPO view. Never return platformFee, platformFeePercent, totalCharged or
// the admin-side payment split fields from this endpoint.
router.get('/fpo/earnings', protect, authorizeRoles('fpo_admin', 'fpo_staff'), async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] }).select('_id name creditLineAvailable');
    if (!fpo) {
      return res.json({
        totals: { fpoAmount: 0, count: 0 },
        cashFlow: { moneyToReceive: 0, moneyToPay: 0, netPosition: 0, creditLimit: 0, creditUsed: 0, creditAvailable: 0, creditUtilizationPct: 0, pendingPayouts: 0 },
        transactions: [],
      });
    }

    const fpoObjectId = new mongoose.Types.ObjectId(String(fpo._id));
    const [t, payouts] = await Promise.all([
      PaymentTransaction.aggregate([
        { $match: { fpo: fpoObjectId, status: { $in: ['Success', 'Refunded'] } } },
        { $group: { _id: null, successfulFpoAmount: { $sum: { $cond: [{ $eq: ['$status', 'Success'] }, '$fpoAmount', 0] } }, refundedFpoAmount: { $sum: { $cond: [{ $eq: ['$status', 'Refunded'] }, '$fpoAmount', 0] } }, count: { $sum: 1 } } },
      ]),
      Payout.find({ fpo: fpo._id }).select('amount totalAmount fundedFrom status paymentDate paidAt createdAt').lean(),
    ]);

    const totals = t?.[0] || { successfulFpoAmount: 0, refundedFpoAmount: 0, count: 0 };
    // A refunded payment is the same document flipped to 'Refunded', so the Success sum already excludes it.
    const moneyToReceive = Math.max(0, Number(totals.successfulFpoAmount || 0));
    const pending = payouts.filter((p) => p.status === 'Pending');
    const moneyToPay = pending.reduce((sum, p) => sum + Number(p.amount ?? p.totalAmount ?? 0), 0);
    const creditUsed = payouts
      .filter((p) => p.fundedFrom === 'CREDIT_LINE' && ['Pending', 'Completed'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount ?? p.totalAmount ?? 0), 0);
    const creditLimit = Number(fpo.creditLineAvailable || 0);
    const creditAvailable = Math.max(0, creditLimit - creditUsed);

    // Only FPO-safe fields are selected. In particular, no platform-fee field.
    const transactions = await PaymentTransaction.find({ fpo: fpo._id })
      .sort({ createdAt: -1 }).limit(50)
      .select('transactionId order fpoAmount status createdAt');

    res.json({
      totals: { fpoAmount: Number(totals.successfulFpoAmount || 0), count: Number(totals.count || 0) },
      cashFlow: {
        moneyToReceive,
        moneyToPay,
        netPosition: moneyToReceive - moneyToPay,
        creditLimit,
        creditUsed,
        creditAvailable,
        creditUtilizationPct: creditLimit ? (creditUsed / creditLimit) * 100 : 0,
        pendingPayouts: pending.length,
      },
      transactions,
    });
  } catch (e) {
    console.error('FPO earnings error:', e);
    res.status(500).json({ message: 'Unable to load FPO earnings.' });
  }
});

// FPO view: working-capital picture (payables aging, COD still to collect, credit line, 30-day cover check).
router.get('/fpo/cash-flow', protect, authorizeRoles('fpo_admin', 'fpo_staff'), async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] }).select('_id creditLineAvailable');
    if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    res.json(await buildCashFlow(fpo));
  } catch (e) {
    console.error('FPO cash-flow error:', e);
    res.status(500).json({ message: 'Unable to load cash flow.' });
  }
});

// FPO view: bank / CA / CBBO-ready pack (summary tables + chronological ledger) for a chosen period.
// Optional query: ?from=YYYY-MM-DD&to=YYYY-MM-DD (defaults to the Indian financial year to date).
router.get('/fpo/bank-pack', protect, authorizeRoles('fpo_admin', 'fpo_staff'), async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] })
      .select('name registrationType registrationNumber dateOfIncorporation gstin schemeName shareholderFarmerCount cbboName contactDetails creditLineAvailable');
    if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    res.json(await buildBankPack(fpo, req.query.from, req.query.to));
  } catch (e) {
    if (e && e.status === 400) return res.status(400).json({ message: e.message });
    console.error('FPO bank-pack error:', e);
    res.status(500).json({ message: 'Unable to build the bank-ready pack.' });
  }
});

module.exports = router;
