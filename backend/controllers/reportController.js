const Fpo = require('../models/Fpo');
const Farmer = require('../models/Farmer');
const Batch = require('../models/Batch');
const FpoOrder = require('../models/FpoOrder');
const Payout = require('../models/Payout');

const getFpoIdForUser = async (userId) => {
  if (!userId) return null;
  const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
  return fpo ? fpo._id : null;
};

// 1. Revenue + grade distribution + best-selling produce (from delivered/placed orders)
exports.getSalesReport = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json({ totalRevenue: 0, bestSelling: [], gradeDistribution: [] });

    const orders = await FpoOrder.find({ fpo: fpoId, status: { $ne: 'Cancelled' } }).populate('listing', 'produceType grade');

    let totalRevenue = 0;
    const byProduce = {};
    const byGrade = {};

    orders.forEach((o) => {
      totalRevenue += o.totalPrice;
      const produceType = o.listing?.produceType || 'Unknown';
      const grade = o.listing?.grade || 'Unknown';
      byProduce[produceType] = (byProduce[produceType] || 0) + o.quantityKg;
      byGrade[grade] = (byGrade[grade] || 0) + o.quantityKg;
    });

    const bestSelling = Object.entries(byProduce)
      .map(([produceType, quantityKg]) => ({ produceType, quantityKg }))
      .sort((a, b) => b.quantityKg - a.quantityKg);

    const gradeDistribution = Object.entries(byGrade).map(([grade, quantityKg]) => ({ grade, quantityKg }));

    res.json({ totalRevenue, bestSelling, gradeDistribution, totalOrders: orders.length });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 2. Farmer-wise performance — total intake quantity & batch count per farmer
exports.getFarmerPerformance = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json([]);

    const batches = await Batch.find({ fpo: fpoId }).populate('farmer', 'name phone');
    const byFarmer = {};

    batches.forEach((b) => {
      if (!b.farmer) return;
      const key = b.farmer._id.toString();
      if (!byFarmer[key]) {
        byFarmer[key] = { farmerId: key, name: b.farmer.name, phone: b.farmer.phone, totalBatches: 0, totalKg: 0 };
      }
      byFarmer[key].totalBatches += 1;
      byFarmer[key].totalKg += b.rawQuantityKg;
    });

    res.json(Object.values(byFarmer).sort((a, b) => b.totalKg - a.totalKg));
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 3. Monthly summary — intake kg and revenue grouped by month
exports.getMonthlyReport = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json([]);

    const batches = await Batch.find({ fpo: fpoId });
    const orders = await FpoOrder.find({ fpo: fpoId, status: { $ne: 'Cancelled' } });

    const monthKey = (date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const byMonth = {};
    batches.forEach((b) => {
      const key = monthKey(b.createdAt);
      byMonth[key] = byMonth[key] || { month: key, intakeKg: 0, revenue: 0 };
      byMonth[key].intakeKg += b.rawQuantityKg;
    });
    orders.forEach((o) => {
      const key = monthKey(o.createdAt);
      byMonth[key] = byMonth[key] || { month: key, intakeKg: 0, revenue: 0 };
      byMonth[key].revenue += o.totalPrice;
    });

    res.json(Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)));
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 4. FPO earnings + order-wise settlement view
exports.getSettlement = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json({ totalEarnings: 0, orders: [] });

    const orders = await FpoOrder.find({ fpo: fpoId, status: { $ne: 'Cancelled' } })
      .populate('listing', 'produceType grade pricePerKg')
      .populate('consumer', 'name')
      .sort({ createdAt: -1 });

    const totalEarnings = orders.reduce((sum, o) => sum + o.totalPrice, 0);

    res.json({
      totalEarnings,
      orders: orders.map((o) => ({
        orderId: o._id,
        produceType: o.listing?.produceType,
        grade: o.listing?.grade,
        consumer: o.consumer?.name,
        quantityKg: o.quantityKg,
        totalPrice: o.totalPrice,
        status: o.status,
        date: o.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 5. Download payout report as CSV
exports.downloadPayoutReport = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const payouts = await Payout.find({ fpo: fpoId }).populate('farmer', 'name phone').populate('batch', 'batchId');

    const header = 'Farmer Name,Phone,Batch ID,Amount,Status,Transaction ID,Date\n';
    const rows = payouts.map((p) => {
      const line = [
        p.farmer?.name || '',
        p.farmer?.phone || '',
        p.batch?.batchId || '',
        p.amount,
        p.status,
        p.transactionId || '',
        p.paymentDate ? new Date(p.paymentDate).toISOString() : '',
      ];
      // Basic CSV-escaping for any field that might contain a comma
      return line.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csv = header + rows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payout_report.csv"');
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
