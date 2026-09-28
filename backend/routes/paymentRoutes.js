const express = require('express');
const mongoose = require('mongoose');
const PaymentTransaction = require('../models/PaymentTransaction');
const Fpo = require('../models/Fpo');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

// Platform (government admin) view: total platform fee collected.
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
    res.status(500).json({ message: e.message });
  }
});

// FPO view: what has been credited to this FPO.
router.get('/fpo/earnings', protect, authorizeRoles('fpo_admin', 'fpo_staff'), async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
    if (!fpo) return res.json({ totals: { fpoAmount: 0, platformFee: 0, count: 0 }, transactions: [] });
    const [t] = await PaymentTransaction.aggregate([
      { $match: { fpo: new mongoose.Types.ObjectId(String(fpo._id)), status: 'Success' } },
      { $group: { _id: null, fpoAmount: { $sum: '$fpoAmount' }, platformFee: { $sum: '$platformFee' }, count: { $sum: 1 } } },
    ]);
    const transactions = await PaymentTransaction.find({ fpo: fpo._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ totals: t || { fpoAmount: 0, platformFee: 0, count: 0 }, transactions });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
