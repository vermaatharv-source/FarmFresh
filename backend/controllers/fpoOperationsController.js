const mongoose = require('mongoose');
const Fpo = require('../models/Fpo');
const Farmer = require('../models/Farmer');
const Batch = require('../models/Batch');
const Inventory = require('../models/Inventory');
const Listing = require('../models/Listing');
const FpoOrder = require('../models/FpoOrder');
const Payout = require('../models/Payout');
const PaymentTransaction = require('../models/PaymentTransaction');
const StockMovement = require('../models/StockMovement');
const MandiPrice = require('../models/MandiPrice');
const ProcurementPlan = require('../models/ProcurementPlan');
const BuyerDemand = require('../models/BuyerDemand');
const LogisticsShipment = require('../models/LogisticsShipment');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const safeId = (id) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(String(id)) : null);
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

async function getFpoId(userId) {
  const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] }).select('_id name cbboName schemeName creditLineAvailable contactDetails shareholderFarmerCount kycStatus');
  return fpo;
}

function getAgingBucket(date) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  if (days <= 1) return '0-1 days';
  if (days <= 3) return '2-3 days';
  if (days <= 5) return '4-5 days';
  return '5+ days';
}

async function buildSummary(fpo) {
    const fpoId = fpo._id;
    const [farmers, batches, inventory, pendingPayouts, completedPayouts, transactions, orders, shipments, demands, plans, movements] = await Promise.all([
      Farmer.find({ fpo: fpoId }).select('name village district state cropsGrown landHoldingAcres isActive isVerified totalEarnedLifetime createdAt'),
      Batch.find({ fpo: fpoId }).select('batchId farmer produceType rawQuantityKg harvestDate collectionDate grading amountOwedToFarmer payoutStatus createdAt').lean(),
      Inventory.find({ fpo: fpoId }).lean(),
      Payout.find({ fpo: fpoId, status: 'Pending' }).select('amount totalAmount farmer batch fundedFrom createdAt').populate('farmer', 'name memberId').lean(),
      Payout.find({ fpo: fpoId, status: 'Completed' }).select('amount totalAmount fundedFrom paymentDate paidAt createdAt').lean(),
      PaymentTransaction.find({ fpo: fpoId }).select('fpoAmount status createdAt order').lean(),
      FpoOrder.find({ fpo: fpoId }).select('listing quantityKg totalPrice fpoAmount status createdAt paymentStatus').populate('listing', 'produceType grade pricePerKg sourceBatch').lean(),
      LogisticsShipment.find({ fpo: fpoId }).sort({ eta: 1 }).limit(50).lean(),
      BuyerDemand.find({ fpo: fpoId, status: { $in: ['OPEN', 'MATCHED'] } }).sort({ deliveryDate: 1 }).limit(50).lean(),
      ProcurementPlan.find({ fpo: fpoId, status: { $in: ['OPEN', 'PARTIALLY_FULFILLED'] } }).sort({ requiredBy: 1 }).limit(50).lean(),
      StockMovement.find({ fpo: fpoId }).sort({ createdAt: -1 }).limit(500).lean(),
    ]);

    const successfulPayments = transactions.filter((t) => t.status === 'Success');
    const moneyToReceive = round2(successfulPayments.reduce((s, t) => s + (t.fpoAmount || 0), 0) - transactions.filter((t) => t.status === 'Refunded').reduce((s, t) => s + (t.fpoAmount || 0), 0));
    const moneyToPay = round2(pendingPayouts.reduce((s, p) => s + (p.amount ?? p.totalAmount ?? 0), 0));
    const creditUsed = round2(completedPayouts.filter((p) => p.fundedFrom === 'CREDIT_LINE').reduce((s, p) => s + (p.amount ?? p.totalAmount ?? 0), 0) + pendingPayouts.filter((p) => p.fundedFrom === 'CREDIT_LINE').reduce((s, p) => s + (p.amount ?? p.totalAmount ?? 0), 0));
    const creditLimit = round2(fpo.creditLineAvailable || 0);

    const aging = { '0-1 days': 0, '2-3 days': 0, '4-5 days': 0, '5+ days': 0 };
    for (const b of batches) aging[getAgingBucket(b.collectionDate || b.createdAt)] += Number(b.rawQuantityKg || 0);
    const inventoryTotal = round1(inventory.reduce((s, x) => s + (x.totalQuantity || 0), 0));
    const inventoryReserved = round1(inventory.reduce((s, x) => s + (x.reservedQuantity || 0), 0));
    const inventorySold = round1(inventory.reduce((s, x) => s + (x.soldQuantity || 0), 0));

    const farmerPayableByBatch = new Map(batches.map((b) => [String(b._id), Number(b.amountOwedToFarmer || 0)]));
    const batchKgById = new Map(batches.map((b) => [String(b._id), Math.max(0.001, Number(b.rawQuantityKg || 0))]));
    const shipmentCostByOrder = new Map();
    shipments.forEach((s) => { if (s.order) shipmentCostByOrder.set(String(s.order), (shipmentCostByOrder.get(String(s.order)) || 0) + Number(s.transportCost || 0)); });
    let estimatedContribution = 0;
    for (const order of orders) {
      if (!['Paid', 'Success'].includes(order.paymentStatus) && !['Delivered', 'Dispatched', 'Packed', 'Accepted'].includes(order.status)) continue;
      const revenue = Number(order.fpoAmount || 0) || Number(order.totalPrice || 0);
      const batchId = order.listing?.sourceBatch ? String(order.listing.sourceBatch) : null;
      const procurementRate = batchId ? (farmerPayableByBatch.get(batchId) || 0) / (batchKgById.get(batchId) || 1) : 0;
      estimatedContribution += revenue - (procurementRate * Number(order.quantityKg || 0)) - (shipmentCostByOrder.get(String(order._id)) || 0);
    }

    const byProduce = {};
    batches.forEach((b) => {
      const key = String(b.produceType || 'Unknown').trim().toLowerCase();
      if (!byProduce[key]) byProduce[key] = { produceType: b.produceType, intakeKg: 0, gradeA: 0, gradeB: 0, gradeC: 0, qualityTotal: 0, qualityCount: 0 };
      byProduce[key].intakeKg += Number(b.rawQuantityKg || 0);
      byProduce[key].gradeA += Number(b.grading?.gradeA_Kg || 0);
      byProduce[key].gradeB += Number(b.grading?.gradeB_Kg || 0);
      byProduce[key].gradeC += Number(b.grading?.gradeC_Kg || 0);
      if (Number.isFinite(b.grading?.qualityScore)) { byProduce[key].qualityTotal += b.grading.qualityScore; byProduce[key].qualityCount += 1; }
    });
    const quality = Object.values(byProduce).map((x) => ({
      produceType: x.produceType,
      intakeKg: round1(x.intakeKg),
      gradeA: round1(x.gradeA), gradeB: round1(x.gradeB), gradeC: round1(x.gradeC),
      gradeAPct: round1(x.intakeKg ? (x.gradeA / x.intakeKg) * 100 : 0),
      avgQualityScore: round1(x.qualityCount ? x.qualityTotal / x.qualityCount : 0),
    })).sort((a, b) => b.intakeKg - a.intakeKg);

    const geography = {};
    farmers.forEach((f) => {
      const key = [f.district, f.state].filter(Boolean).join(', ') || 'Location not recorded';
      if (!geography[key]) geography[key] = { location: key, farmers: 0, active: 0, landAcres: 0, produceTypes: new Set() };
      geography[key].farmers += 1;
      geography[key].active += f.isActive ? 1 : 0;
      geography[key].landAcres += Number(f.landHoldingAcres || 0);
      (f.cropsGrown || []).forEach((c) => geography[key].produceTypes.add(c));
    });
    const geographicClusters = Object.values(geography).map((x) => ({ ...x, landAcres: round1(x.landAcres), produceTypes: Array.from(x.produceTypes).slice(0, 20) })).sort((a, b) => b.farmers - a.farmers);

    const now = new Date();
    const recentStart = addDays(startOfDay(now), -90);
    const recentOrders = orders.filter((o) => new Date(o.createdAt) >= recentStart && !['Cancelled', 'Refunded'].includes(o.status));
    const demandByProduce = {};
    recentOrders.forEach((o) => {
      const name = o.listing?.produceType || 'Unknown';
      const key = name.toLowerCase();
      if (!demandByProduce[key]) demandByProduce[key] = { produceType: name, quantityKg: 0, orders: 0 };
      demandByProduce[key].quantityKg += Number(o.quantityKg || 0); demandByProduce[key].orders += 1;
    });
    const forecast = Object.values(demandByProduce).map((x) => ({ ...x, avgDailyKg90d: round1(x.quantityKg / 90), forecast7dKg: round1((x.quantityKg / 90) * 7) })).sort((a, b) => b.forecast7dKg - a.forecast7dKg);

    const overdueTasks = 0;
    const reconciliation = await buildReconciliation(fpoId, inventory, movements, batches, orders, pendingPayouts);

    return {
      fpo: { id: fpo._id, name: fpo.name, cbboName: fpo.cbboName, schemeName: fpo.schemeName || '', creditLineAvailable: creditLimit, kycStatus: fpo.kycStatus },
      cashFlow: { moneyToReceive, moneyToPay, netPosition: round2(moneyToReceive - moneyToPay), creditLimit, creditUsed, creditAvailable: round2(Math.max(0, creditLimit - creditUsed)), creditUtilizationPct: round1(creditLimit ? (creditUsed / creditLimit) * 100 : 0), pendingPayouts: pendingPayouts.length },
      commandCenter: { farmers: farmers.length, activeFarmers: farmers.filter((x) => x.isActive).length, batches: batches.length, inventoryKg: inventoryTotal, reservedKg: inventoryReserved, soldKg: inventorySold, orders: orders.length, pendingOrders: orders.filter((o) => ['Placed', 'Accepted', 'Packed'].includes(o.status)).length, shipmentsInTransit: shipments.filter((s) => ['PICKED_UP', 'IN_TRANSIT'].includes(s.status)).length, inventoryAging: aging },
      profitability: { estimatedContributionBeforeOverhead: round2(estimatedContribution), methodology: 'FPO share minus estimated farmer procurement cost and recorded shipment cost; overheads are not included.' },
      quality, geographicClusters, demandForecast: forecast, procurementPlans: plans, buyerDemands: demands, shipments, reconciliation,
      alerts: buildAlerts({ pendingPayouts, aging, creditLimit, creditUsed, reconciliation, orders, shipments }),
    };
}

exports.summary = async (req, res) => {
  try {
    const fpo = await getFpoId(req.user._id || req.user.id);
    if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    res.json(await buildSummary(fpo));
  } catch (e) {
    console.error('FPO operations summary error:', e);
    res.status(500).json({ message: 'Unable to load FPO operations dashboard.' });
  }
};

// Flat set of live numbers the Operations Assistant answers from.
// Built on the same calculation as the dashboard summary, so the chatbot and the dashboard never disagree.
async function getAssistantSnapshot(fpo) {
  const sum = await buildSummary(fpo);
  const cf = sum.cashFlow || {};
  const cc = sum.commandCenter || {};
  return {
    pendingPayouts: { count: Number(cf.pendingPayouts) || 0, amount: Number(cf.moneyToPay) || 0 },
    moneyToReceive: Number(cf.moneyToReceive) || 0,
    inventoryKg: Number(cc.inventoryKg) || 0,
    aging5Plus: Number(cc.inventoryAging?.['5+ days']) || 0,
    creditUsed: Number(cf.creditUsed) || 0,
    creditLimit: Number(cf.creditLimit) || 0,
    contribution: Number(sum.profitability?.estimatedContributionBeforeOverhead) || 0,
    forecast: sum.demandForecast || [],
    quality: sum.quality || [],
    inventoryIssues: Number(sum.reconciliation?.inventoryIssues) || 0,
    shipmentsInTransit: Number(cc.shipmentsInTransit) || 0,
  };
}

async function buildReconciliation(fpoId, inventory, movements, batches, orders, pendingPayouts) {
  const movementNet = {};
  for (const m of movements) {
    const key = `${String(m.produceType).toLowerCase()}|${String(m.grade || '').toUpperCase()}`;
    const q = Number(m.quantityKg || 0);
    if (!movementNet[key]) movementNet[key] = { produceType: m.produceType, grade: m.grade, intake: 0, reserved: 0, released: 0, sold: 0, cancelled: 0, adjustment: 0 };
    if (m.type === 'Intake') movementNet[key].intake += q;
    else if (m.type === 'Reserved') movementNet[key].reserved += q;
    else if (m.type === 'Released') movementNet[key].released += q;
    else if (m.type === 'Sold') movementNet[key].sold += q;
    else if (m.type === 'Cancelled') movementNet[key].cancelled += q;
    else if (m.type === 'Adjustment') movementNet[key].adjustment += q;
  }
  const rows = inventory.map((i) => {
    const key = `${String(i.produceType).toLowerCase()}|${String(i.grade).toUpperCase()}`;
    const m = movementNet[key] || { intake: 0, reserved: 0, released: 0, sold: 0, cancelled: 0, adjustment: 0 };
    const expected = m.intake + m.cancelled + m.adjustment - m.sold;
    const actual = Number(i.totalQuantity || 0);
    return { produceType: i.produceType, grade: i.grade, expectedKg: round1(expected), actualKg: round1(actual), differenceKg: round1(actual - expected), status: Math.abs(actual - expected) <= 0.1 ? 'MATCH' : 'CHECK' };
  });
  const payoutDue = pendingPayouts.reduce((s, p) => s + Number(p.amount ?? p.totalAmount ?? 0), 0);
  const orderQuantity = orders.reduce((s, o) => s + Number(o.quantityKg || 0), 0);
  return { inventory: rows, inventoryIssues: rows.filter((x) => x.status === 'CHECK').length, pendingPayoutAmount: round2(payoutDue), orderQuantityKg: round1(orderQuantity), generatedAt: new Date().toISOString() };
}

function buildAlerts({ pendingPayouts, aging, creditLimit, creditUsed, reconciliation, orders, shipments }) {
  const alerts = [];
  if (pendingPayouts.length) alerts.push({ severity: 'MEDIUM', type: 'PAYOUT', message: `${pendingPayouts.length} farmer payout(s) are pending.` });
  if (aging['5+ days'] > 0) alerts.push({ severity: 'HIGH', type: 'INVENTORY', message: `${round1(aging['5+ days'])} kg of intake is older than 5 days; review for dispatch, processing or markdown.` });
  if (creditLimit > 0 && creditUsed / creditLimit >= 0.8) alerts.push({ severity: 'HIGH', type: 'CREDIT', message: `Credit-line utilization is ${round1((creditUsed / creditLimit) * 100)}%.` });
  if (reconciliation.inventoryIssues) alerts.push({ severity: 'HIGH', type: 'RECONCILIATION', message: `${reconciliation.inventoryIssues} inventory line(s) do not reconcile with recorded stock movements.` });
  if (orders.some((o) => o.status === 'Placed')) alerts.push({ severity: 'MEDIUM', type: 'ORDER', message: `${orders.filter((o) => o.status === 'Placed').length} order(s) are awaiting FPO acceptance.` });
  if (shipments.some((s) => s.status === 'IN_TRANSIT' && s.eta && new Date(s.eta) < new Date())) alerts.push({ severity: 'HIGH', type: 'LOGISTICS', message: 'One or more shipments have passed their recorded ETA.' });
  return alerts;
}

exports.createProcurementPlan = async (req, res) => {
  try {
    const fpo = await getFpoId(req.user._id || req.user.id); if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    const { produceType, requiredQuantityKg, targetPricePerKg, requiredBy, notes } = req.body;
    if (!produceType || !Number.isFinite(Number(requiredQuantityKg)) || Number(requiredQuantityKg) <= 0 || !requiredBy) return res.status(400).json({ message: 'Produce, quantity and required-by date are required.' });
    const requiredByDate = new Date(requiredBy);
    if (Number.isNaN(requiredByDate.getTime())) return res.status(400).json({ message: 'Invalid required-by date.' });
    const plan = await ProcurementPlan.create({ fpo: fpo._id, produceType: String(produceType).trim(), requiredQuantityKg: Number(requiredQuantityKg), targetPricePerKg: Math.max(0, Number(targetPricePerKg) || 0), requiredBy: requiredByDate, notes: String(notes || '').trim() });
    res.status(201).json(plan);
  } catch (e) { res.status(500).json({ message: 'Unable to create procurement plan.' }); }
};

exports.createBuyerDemand = async (req, res) => {
  try {
    const fpo = await getFpoId(req.user._id || req.user.id); if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    const { buyerName, buyerType, produceType, quantityKg, targetPricePerKg, deliveryDate, deliveryLocation, notes } = req.body;
    if (!buyerName || !produceType || !Number.isFinite(Number(quantityKg)) || Number(quantityKg) <= 0 || !deliveryDate) return res.status(400).json({ message: 'Buyer, produce, quantity and delivery date are required.' });
    const deliveryDateValue = new Date(deliveryDate);
    if (Number.isNaN(deliveryDateValue.getTime())) return res.status(400).json({ message: 'Invalid delivery date.' });
    const validBuyerTypes = ['RESTAURANT', 'KIRANA', 'WHOLESALER', 'PROCESSOR', 'INSTITUTION', 'OTHER'];
    const normalizedBuyerType = validBuyerTypes.includes(buyerType) ? buyerType : 'OTHER';
    const demand = await BuyerDemand.create({ fpo: fpo._id, buyerName: String(buyerName).trim(), buyerType: normalizedBuyerType, produceType: String(produceType).trim(), quantityKg: Number(quantityKg), targetPricePerKg: Math.max(0, Number(targetPricePerKg) || 0), deliveryDate: deliveryDateValue, deliveryLocation: String(deliveryLocation || '').trim(), notes: String(notes || '').trim() });
    res.status(201).json(demand);
  } catch (e) { res.status(500).json({ message: 'Unable to create buyer demand.' }); }
};

exports.createShipment = async (req, res) => {
  try {
    const fpo = await getFpoId(req.user._id || req.user.id); if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    const body = req.body || {};
    if (!Number.isFinite(Number(body.quantityKg)) || Number(body.quantityKg) <= 0) return res.status(400).json({ message: 'Quantity is required.' });
    if (body.order && !safeId(body.order)) return res.status(400).json({ message: 'Invalid order ID.' });
    const validShipmentStatuses = ['PLANNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
    const shipmentStatus = validShipmentStatuses.includes(body.status) ? body.status : 'PLANNED';
    const shipment = await LogisticsShipment.create({ fpo: fpo._id, order: safeId(body.order), buyerDemand: safeId(body.buyerDemand), vehicleNumber: String(body.vehicleNumber || '').trim(), driverName: String(body.driverName || '').trim(), driverPhone: String(body.driverPhone || '').trim(), origin: String(body.origin || '').trim(), destination: String(body.destination || '').trim(), quantityKg: Number(body.quantityKg), transportCost: Math.max(0, Number(body.transportCost) || 0), pickupAt: body.pickupAt ? new Date(body.pickupAt) : undefined, eta: body.eta ? new Date(body.eta) : undefined, status: shipmentStatus, notes: String(body.notes || '').trim() });
    res.status(201).json(shipment);
  } catch (e) { res.status(500).json({ message: 'Unable to create shipment.' }); }
};

exports.updateShipment = async (req, res) => {
  try {
    const fpo = await getFpoId(req.user._id || req.user.id); if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    const id = safeId(req.params.id); if (!id) return res.status(400).json({ message: 'Invalid shipment ID.' });
    const allowed = ['vehicleNumber','driverName','driverPhone','origin','destination','quantityKg','transportCost','pickupAt','eta','deliveredAt','status','notes'];
    const patch = {}; allowed.forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
    if (patch.quantityKg !== undefined) patch.quantityKg = Number(patch.quantityKg);
    if (patch.transportCost !== undefined) patch.transportCost = Math.max(0, Number(patch.transportCost) || 0);
    ['pickupAt','eta','deliveredAt'].forEach((k) => { if (patch[k]) patch[k] = new Date(patch[k]); });
    const updated = await LogisticsShipment.findOneAndUpdate({ _id: id, fpo: fpo._id }, patch, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: 'Shipment not found.' });
    res.json(updated);
  } catch (e) { res.status(500).json({ message: 'Unable to update shipment.' }); }
};

exports.priceIntelligence = async (req, res) => {
  try {
    const fpo = await getFpoId(req.user._id || req.user.id); if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });
    const listings = await Listing.find({ fpo: fpo._id, status: 'Published' }).select('produceType grade pricePerKg availableQuantityKg').lean();
    const names = [...new Set(listings.map((x) => x.produceType).filter(Boolean))];
    const rows = [];
    for (const name of names) {
      const latest = await MandiPrice.findOne({ commodityName: new RegExp(`^${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i') }).sort({ date: -1 }).lean();
      const listingPrices = listings.filter((x) => x.produceType.toLowerCase() === name.toLowerCase());
      const listingPrice = listingPrices.length ? listingPrices.reduce((s, x) => s + Number(x.pricePerKg || 0), 0) / listingPrices.length : 0;
      rows.push({ produceType: name, listingPricePerKg: round2(listingPrice), mandiModalPricePerKg: round2(latest?.modalPrice || 0), mandiMinPricePerKg: round2(latest?.minPrice || 0), mandiMaxPricePerKg: round2(latest?.maxPrice || 0), market: latest?.market || null, state: latest?.state || null, priceDate: latest?.date || null, source: latest?.source || null, differencePct: latest?.modalPrice ? round1(((listingPrice - latest.modalPrice) / latest.modalPrice) * 100) : null });
    }
    res.json({ prices: rows });
  } catch (e) { res.status(500).json({ message: 'Unable to load price intelligence.' }); }
};

const OPERATIONS_CATALOG = [
  {
    id: 'add-farmer',
    title: 'How to Register / Add a New Farmer',
    category: 'Farmers',
    navTab: 'farmers',
    keywords: ['farmer', 'add farmer', 'register farmer', 'farmer registration', 'kisan', 'onboard farmer'],
    summary: 'Add a new smallholder or shareholder farmer to your FPO database with full bank & statutory details.',
    steps: [
      'Navigate to the "Farmers" tab on the main FPO navigation bar.',
      'Under the "Register New Farmer" section, enter the farmer\'s Personal Details (Full Name, Phone Number, Aadhaar Number, Gender, Category).',
      'Fill in Farm & Crop Details (Village, Block, District, State, Land Holding in Acres, Crops Grown).',
      'Enter Banking Details (Account Number, IFSC Code, Bank Name) and FPO Member ID.',
      'Click the green "Register Farmer" button to save.',
    ],
    tips: 'Ensure the phone number is 10 digits and IFSC code is valid for automated DBT payouts. You can also use "Bulk Upload Farmers (CSV)" if you have multiple farmers.',
  },
  {
    id: 'bulk-farmers-csv',
    title: 'How to Bulk Upload Farmers via CSV',
    category: 'Farmers',
    navTab: 'farmers',
    keywords: ['csv', 'bulk upload', 'upload farmers', 'import farmers', 'excel'],
    summary: 'Import dozens or hundreds of farmer records at once using a standard CSV spreadsheet.',
    steps: [
      'Click on the "Farmers" tab in the top navigation bar.',
      'Scroll down to the "Bulk Upload Farmers (CSV)" card.',
      'Download the sample CSV format template to match column headers: Name, Phone, Aadhaar, Village, District, State, LandAcres, Crops, AccountNo, IFSC.',
      'Click "Choose File" and select your filled .csv file.',
      'Click "Upload CSV" to parse and insert all valid farmer records simultaneously.',
    ],
    tips: 'Ensure there are no blank phone numbers or missing names in your spreadsheet before uploading.',
  },
  {
    id: 'intake-batch',
    title: 'How to Record Produce Intake & Generate Batches',
    category: 'Intake & Quality',
    navTab: 'intake',
    keywords: ['intake', 'record intake', 'batch', 'create batch', 'produce intake', 'collection', 'harvest'],
    summary: 'Log produce brought by a farmer to the collection center and assign a unique traceable Batch ID.',
    steps: [
      'Go to the "Intake & Grading" tab in the navigation.',
      'Under "Record New Produce Intake", select the registered Farmer from the dropdown list.',
      'Enter the Produce Type (e.g. Tomatoes, Wheat, Potatoes, Basmati Rice).',
      'Input the Raw Quantity in kg received at the weighbridge.',
      'Specify the Harvest Date / Collection Date.',
      'Click "Record Intake & Generate Batch" to generate a unique Batch ID with its verifiable digital QR code.',
    ],
    tips: 'Every batch created is instantly assigned a cryptographic QR code that allows buyers and consumers to trace its farm origin.',
  },
  {
    id: 'grading-quality',
    title: 'How to Perform Batch Grading & Quality Inspection',
    category: 'Intake & Quality',
    navTab: 'intake',
    keywords: ['grading', 'grade', 'quality', 'grade a', 'grade b', 'grade c', 'inspection', 'quality score'],
    summary: 'Grade the harvested batch into Grade A, B, and C portions and calculate farmer payable amounts.',
    steps: [
      'Navigate to the "Intake & Grading" tab and locate the "Pending Batches for Grading" table.',
      'Click "Grade This Batch" on the batch you want to evaluate.',
      'Enter the quantities for Grade A (Premium), Grade B (Standard), and Grade C (Industrial/Local) in kg.',
      'Assign an overall Quality Score (0 to 100).',
      'Select the batch status (Approved or Rejected).',
      'Click "Submit Grading". Graded produce is automatically moved into Inventory ready for listing!',
    ],
    tips: 'The sum of Grade A + B + C must match the raw intake weight. Grade A produce commands the highest market premium.',
  },
  {
    id: 'inventory-management',
    title: 'How to Manage Inventory & Track Stock',
    category: 'Operations',
    navTab: 'inventory',
    keywords: ['inventory', 'stock', 'available stock', 'stock management', 'godown', 'warehouse'],
    summary: 'Monitor live warehouse stock levels categorized by crop type, grade, available kg, and reserved kg.',
    steps: [
      'Click on the "Inventory" tab on the top menu.',
      'Review the summary cards: Total Stock (kg), Reserved Stock (kg), and Sold Stock (kg).',
      'Check the breakdown table to see exact available weights per Produce Type and Grade (A/B/C).',
      'Set or update base selling prices per kg directly on each inventory line.',
      'Switch to "FPO Operations > Inventory Aging" to review older lots (5+ days) and prioritize dispatch.',
    ],
    tips: 'When an institutional buyer or consumer places an order, quantity is moved to "Reserved" until dispatched or fulfilled.',
  },
  {
    id: 'create-listing',
    title: 'How to Create & Publish a Marketplace Listing',
    category: 'Marketplace',
    navTab: 'listings',
    keywords: ['listing', 'create listing', 'publish listing', 'sell produce', 'marketplace listing', 'sell online'],
    summary: 'List your graded warehouse inventory on the consumer and B2B marketplace to start receiving orders.',
    steps: [
      'Go to the "Listings" tab in the top navigation bar.',
      'Click "Create New Listing" or fill in the listing form.',
      'Select the source graded inventory batch / produce type.',
      'Set the Price per kg (₹/kg) and Available Quantity in kg.',
      'Add high-quality photos of the produce (upload up to 3 images or image URLs).',
      'Enter description, farm origin, shelf life, and certification highlights.',
      'Click "Publish Listing". Your produce is immediately live on the FarmFresh marketplace!',
    ],
    tips: 'Check "Price Intelligence" in FPO Operations first to ensure your listing price is competitive against live Agmarknet Mandi rates.',
  },
  {
    id: 'order-fulfillment',
    title: 'How to Accept, Pack, and Fulfill Orders',
    category: 'Orders & Sales',
    navTab: 'orders',
    keywords: ['order', 'fulfill order', 'accept order', 'pack order', 'dispatch order', 'deliver order', 'orders'],
    summary: 'Manage consumer and B2B buyer orders through every step of the fulfillment lifecycle.',
    steps: [
      'Open the "Orders" tab to view all placed and active orders.',
      'For newly "Placed" orders, click "Accept Order" to confirm inventory allocation.',
      'Once packaged and prepped in the warehouse, update the order status to "Packed".',
      'When the logistics driver or delivery partner picks up the produce, mark the order as "Dispatched".',
      'Once delivered to the buyer, mark as "Delivered" to finalize the order.',
    ],
    tips: 'Funds are securely released to the FPO payout balance once delivery or fulfillment criteria are confirmed.',
  },
  {
    id: 'farmer-payouts',
    title: 'How to Process Farmer Settlement & Payouts',
    category: 'Finance',
    navTab: 'payouts',
    keywords: ['payout', 'farmer payout', 'settlement', 'pay farmer', 'farmer payment', 'dbt', 'credit line payment'],
    summary: 'Disburse earnings to farmers for their delivered crops via Direct Bank Transfer or Credit Line.',
    steps: [
      'Click on the "Payouts" tab on the main navigation.',
      'View the "Pending Farmer Payouts" list showing amount owed per farmer and batch.',
      'Click "Pay Now" next to the pending settlement record.',
      'Select payment source: "Direct Escrow/Bank Transfer" or "FPO Working Capital Credit Line".',
      'Confirm the transaction. The payout status updates to "Completed" with an instant transaction receipt.',
    ],
    tips: 'You can print official PDF payout statements for accounting from "FPO Operations > Documents".',
  },
  {
    id: 'procurement-plan',
    title: 'How to Create a Procurement Plan',
    category: 'Operations',
    navTab: 'operations',
    keywords: ['procurement', 'procurement plan', 'buy target', 'crop target', 'advance procurement'],
    summary: 'Set strategic procurement volume and target buy prices to coordinate farmer harvesting schedules.',
    steps: [
      'Go to "FPO Operations" tab and select the "Procurement" sub-tab.',
      'Fill in the Produce Type you need to procure (e.g. Organic Wheat, Tomato).',
      'Enter the Required Quantity (kg) and Target Price (₹/kg).',
      'Pick the "Required By" target date and add any operational notes.',
      'Click "Create plan". Open procurement plans will guide collection center staff on intake targets.',
    ],
    tips: 'Align your procurement plans with Institutional Buyer Demand to guarantee pre-sold produce at locked margins.',
  },
  {
    id: 'buyer-demand',
    title: 'How to Log Institutional Buyer Demand (B2B / HoReCa)',
    category: 'Marketplace',
    navTab: 'operations',
    keywords: ['buyer demand', 'institutional buyer', 'b2b demand', 'hotel', 'restaurant', 'kirana', 'wholesaler'],
    summary: 'Record bulk demand contracts from restaurants, processors, retail chains, and wholesalers.',
    steps: [
      'Open "FPO Operations" and switch to the "Buyer Demand" sub-tab.',
      'Enter the Buyer Name and select the Buyer Type (Restaurant, Kirana, Wholesaler, Processor, Institution, Other).',
      'Specify the Produce Type, Quantity in kg, and Target Price (₹/kg).',
      'Enter the scheduled Delivery Date and Delivery Location.',
      'Click "Add demand" to log the requirement on the open institutional demand board.',
    ],
    tips: 'Use open buyer demands to issue advance procurement notices to member farmers.',
  },
  {
    id: 'create-shipment',
    title: 'How to Create and Track Logistics Shipments',
    category: 'Logistics',
    navTab: 'operations',
    keywords: ['shipment', 'logistics', 'vehicle', 'truck', 'driver', 'transport', 'dispatch shipment'],
    summary: 'Coordinate transport vehicles, drivers, origin-destination routes, and track in-transit ETAs.',
    steps: [
      'Navigate to "FPO Operations" and select the "Logistics" sub-tab.',
      'In "Create shipment", fill in Vehicle Number, Driver Name, Origin godown, and Destination location.',
      'Enter Quantity (kg) loaded on the vehicle and estimated Transport Cost (₹).',
      'Set the estimated arrival time (ETA).',
      'Click "Create shipment" to post the shipment to the live Shipment Board and monitor transit status.',
    ],
    tips: 'Alerts in the Command Center will flag any active shipment that has passed its scheduled ETA.',
  },
  {
    id: 'price-intelligence',
    title: 'How to Use Mandi Price Intelligence',
    category: 'Market Intelligence',
    navTab: 'operations',
    keywords: ['mandi', 'price intelligence', 'agmarknet', 'market price', 'modal price', 'rates'],
    summary: 'Compare your FPO marketplace prices against real-time Government Mandi modal, minimum, and maximum rates.',
    steps: [
      'Go to "FPO Operations" and click on the "Price Intelligence" sub-tab.',
      'Review the live comparison table showing your FPO Listing Price vs Mandi Modal Price.',
      'Check the percentage difference column (+% indicates your listing is priced above Mandi benchmark).',
      'Use this intelligence to adjust your listing prices to stay competitive while maximizing farmer profits.',
    ],
    tips: 'Mandi prices sync directly with regional APMC market data records.',
  },
  {
    id: 'demand-forecast',
    title: 'How to Check 7-Day Demand Forecasts',
    category: 'Market Intelligence',
    navTab: 'operations',
    keywords: ['forecast', 'demand forecast', 'predictive demand', 'trends', 'future orders'],
    summary: 'View 7-day predictive demand estimates computed from historical 90-day marketplace order velocity.',
    steps: [
      'Open "FPO Operations" and click on the "Demand Forecast" sub-tab.',
      'View the automated 7-day predicted intake needed per produce commodity.',
      'Review the 90-day cumulative volume data underpinning each forecast.',
      'Use forecasts to pre-schedule farmer harvesting and procurement before supply crunches occur.',
    ],
    tips: 'Forecasts continuously adapt as new consumer and B2B orders are placed on the platform.',
  },
  {
    id: 'reconciliation',
    title: 'How to Perform Inventory & Stock Reconciliation',
    category: 'Operations',
    navTab: 'operations',
    keywords: ['reconciliation', 'reconcile', 'stock mismatch', 'audit stock', 'movement check', 'variance'],
    summary: 'Audit warehouse inventory against recorded stock intake, reservation, and sales movements.',
    steps: [
      'Open "FPO Operations" and click on the "Reconciliation" sub-tab.',
      'Review the summary: Total Inventory Issues (mismatches > 0.1 kg tolerance), Pending Payouts, and Order Quantity.',
      'Inspect the inventory reconciliation table: Expected (Intake - Sold + Adjustments) vs Actual on-hand stock.',
      'If any line shows "CHECK", verify physical godown stock against recent unrecorded dispatch logs.',
    ],
    tips: 'A status of "MATCH" indicates physical and system inventory are in 100% mathematical harmony.',
  },
  {
    id: 'documents-pdf',
    title: 'How to Generate & Print Official PDF Reports',
    category: 'Reports & Documents',
    navTab: 'operations',
    keywords: ['pdf', 'document', 'report', 'print report', 'payout statement', 'inventory report', 'cash flow report'],
    summary: 'Generate standardized, print-ready PDF statements and reports for auditors, banks, and board meetings.',
    steps: [
      'Go to "FPO Operations" and select the "Documents" sub-tab.',
      'Choose the report you wish to generate: Farmer Payout Statement, Inventory Report, Cash Flow Report, or Reconciliation Report.',
      'A new print-ready window will open displaying formatted tables, totals, and timestamps.',
      'Click the "Print / Save as PDF" button or press Ctrl+P (Cmd+P) to save the PDF file to your device.',
    ],
    tips: 'All generated FPO reports exclude confidential platform fee margins, making them safe to share with external auditors.',
  },
  {
    id: 'traceability-passport',
    title: 'How to View & Verify Digital Traceability Passports',
    category: 'Consumer & Traceability',
    navTab: 'trace',
    keywords: ['trace', 'traceability', 'qr', 'passport', 'batch origin', 'farm origin', 'qr code'],
    summary: 'Verify complete farm-to-fork supply chain transparency and quality testing via digital passport.',
    steps: [
      'Scan the QR code printed on the produce packaging or batch label using any mobile camera or QR reader.',
      'Alternatively, visit `/trace/:batchId` directly in your browser.',
      'View the complete verified journey: Farm location & farmer name, Harvest date, Cold chain transit, and Quality Grading score.',
      'Check pesticide/chemical residue testing certificates and certification badges.',
    ],
    tips: 'Sharing the batch QR code with retail buyers dramatically increases consumer trust and allows premium pricing.',
  },
  {
    id: 'profile-kyc',
    title: 'How to Update FPO Profile & KYC Details',
    category: 'Profile & Settings',
    navTab: 'settings',
    keywords: ['profile', 'kyc', 'fpo settings', 'cbbo', 'statutory', 'bank account', 'credit line'],
    summary: 'Manage FPO registration details, CBBO affiliation, official address, and bank account for settlements.',
    steps: [
      'Click on "Profile & KYC" in the main navigation menu.',
      'Update FPO Legal Name, Registration Number, Scheme Name, and Affiliated CBBO.',
      'Review and update Contact Details, Office Address, State, and District.',
      'Ensure Bank Account Details (for receiving buyer payments) are up to date.',
      'Check KYC verification badge (Verified / Pending / In Review).',
    ],
    tips: 'A "Verified" KYC status qualifies your FPO for instant working capital credit lines and higher buyer visibility.',
  },
];

const MATCH_STOPWORDS = new Set(['how', 'to', 'the', 'and', 'for', 'with', 'from', 'your', 'create', 'view', 'check', 'manage', 'update', 'record', 'process', 'generate', 'use', 'perform', 'track', 'log', 'open', 'verify', 'print', 'new', 'official', 'live']);
const normalizeQuestion = (q) => String(q).toLowerCase().replace(/[^a-z0-9\s/]/g, ' ').replace(/\s+/g, ' ').trim();

// Picks the single best guide. A keyword phrase is a strong signal (longer phrase = stronger);
// title words only break ties, and generic verbs like "create" never decide the match on their own.
function findOperation(rawQuestion) {
  const q = ` ${normalizeQuestion(rawQuestion)} `;
  let best = null;
  let bestScore = 0;
  for (const op of OPERATIONS_CATALOG) {
    let score = 0;
    for (const kw of op.keywords) {
      const k = normalizeQuestion(kw);
      if (k && q.includes(` ${k} `)) score += 10 + k.length;
      else if (k && q.includes(k)) score += 4 + Math.floor(k.length / 2);
    }
    if (q.includes(` ${op.id.replace(/-/g, ' ')} `)) score += 12;
    for (const w of normalizeQuestion(op.title).split(' ')) {
      if (w.length > 3 && !MATCH_STOPWORDS.has(w) && q.includes(` ${w}`)) score += 2;
    }
    if (score > bestScore) { best = op; bestScore = score; }
  }
  return bestScore >= 6 ? best : null;
}

exports.assistant = async (req, res) => {
  try {
    const rawQuestion = String(req.body?.question || '').trim();
    if (!rawQuestion) return res.status(400).json({ message: 'Ask a question.' });
    const question = rawQuestion.toLowerCase();
    const fpo = await getFpoId(req.user._id || req.user.id);
    if (!fpo) return res.status(404).json({ message: 'FPO profile not found.' });

    // 1. Check for live metric queries first
    const isLiveMetricsQuery =
      (question.includes('how much') && (question.includes('owe') || question.includes('pay') || question.includes('due'))) ||
      (question.includes('how much') && question.includes('receive')) ||
      (question.includes('what is') && (question.includes('inventory') || question.includes('stock') || question.includes('credit') || question.includes('profit'))) ||
      (question.startsWith('current ') && (question.includes('stock') || question.includes('inventory') || question.includes('credit')));

    let snapshotCache = null;
    const loadSnapshot = async () => (snapshotCache ||= await getAssistantSnapshot(fpo));

    if (isLiveMetricsQuery) {
      const snapshot = await loadSnapshot();
      let liveAnswer = '';
      if (question.includes('owe') || question.includes('pay') || question.includes('farmer') || question.includes('payout')) {
        liveAnswer = `There are currently ${snapshot.pendingPayouts.count} pending farmer payout(s) totaling ₹${snapshot.pendingPayouts.amount.toFixed(2)}. Go to the "Payouts" tab to disburse funds.`;
      } else if (question.includes('receive') || question.includes('receivable')) {
        liveAnswer = `Recorded FPO money to receive is ₹${snapshot.moneyToReceive.toFixed(2)} from completed buyer transactions.`;
      } else if (question.includes('inventory') || question.includes('stock')) {
        liveAnswer = `Current warehouse inventory is ${snapshot.inventoryKg.toFixed(1)} kg. Approximately ${snapshot.aging5Plus.toFixed(1)} kg of intake is older than 5 days and should be prioritized for dispatch.`;
      } else if (question.includes('credit')) {
        liveAnswer = `Credit line used is ₹${snapshot.creditUsed.toFixed(2)} against your available limit of ₹${snapshot.creditLimit.toFixed(2)}.`;
      } else if (question.includes('profit') || question.includes('contribution')) {
        liveAnswer = `Estimated contribution before overhead is ₹${snapshot.contribution.toFixed(2)}.`;
      }

      if (liveAnswer) {
        return res.json({
          type: 'METRIC',
          answer: liveAnswer,
          generatedBy: 'FarmFresh Operations Assistant',
          asOf: new Date().toISOString(),
        });
      }
    }

    // 2. Match against Software Operations Knowledge Catalog
    const matchedOp = findOperation(question);

    if (matchedOp) {
      const formattedSteps = matchedOp.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n');
      const fullAnswer = `### ${matchedOp.title}\n\n**Category:** ${matchedOp.category} | **Target Tab:** \`${matchedOp.navTab}\`\n\n${matchedOp.summary}\n\n**Step-by-Step Instructions:**\n${formattedSteps}\n\n💡 **Tip:** ${matchedOp.tips}`;

      return res.json({
        type: 'OPERATION',
        operation: matchedOp,
        answer: fullAnswer,
        generatedBy: 'FarmFresh Operations Assistant',
        asOf: new Date().toISOString(),
      });
    }

    // 3. Fallback to live snapshot helpers or general guidance
    const snapshot = await loadSnapshot();
    let generalAnswer = '';
    if (question.includes('pay') || question.includes('payout')) {
      generalAnswer = `There are ${snapshot.pendingPayouts.count} pending farmer payouts totaling ₹${snapshot.pendingPayouts.amount.toFixed(2)}. Go to the "Payouts" tab to initiate settlements.`;
    } else if (question.includes('receive') || question.includes('receivable')) {
      generalAnswer = `Recorded FPO money to receive is ₹${snapshot.moneyToReceive.toFixed(2)}.`;
    } else if (question.includes('inventory') || question.includes('stock')) {
      generalAnswer = `Current inventory is ${snapshot.inventoryKg.toFixed(1)} kg. ${snapshot.aging5Plus.toFixed(1)} kg of intake is older than 5 days.`;
    } else if (question.includes('credit')) {
      generalAnswer = `Credit-line usage is ₹${snapshot.creditUsed.toFixed(2)} against a limit of ₹${snapshot.creditLimit.toFixed(2)}.`;
    } else if (question.includes('demand') || question.includes('forecast')) {
      generalAnswer = snapshot.forecast.length
        ? `The highest 7-day demand forecast is ${snapshot.forecast[0].produceType}: ~${snapshot.forecast[0].forecast7dKg.toFixed(1)} kg.`
        : 'There is not enough historical order data to produce a demand forecast yet.';
    } else if (question.includes('quality') || question.includes('grade')) {
      generalAnswer = snapshot.quality.length
        ? `The largest recorded produce stream is ${snapshot.quality[0].produceType}, with ${snapshot.quality[0].gradeAPct.toFixed(1)}% Grade-A output.`
        : 'No graded batch data is available yet.';
    } else if (question.includes('reconcil') || question.includes('mismatch')) {
      generalAnswer = snapshot.inventoryIssues
        ? `${snapshot.inventoryIssues} inventory line(s) need reconciliation against stock movements.`
        : 'Inventory lines currently reconcile within the configured 0.1 kg tolerance.';
    } else if (question.includes('shipment') || question.includes('logistics')) {
      generalAnswer = `${snapshot.shipmentsInTransit} shipment(s) are currently picked up or in transit.`;
    } else {
      generalAnswer = `I know every operation in FarmFresh software! You can ask me how to perform any task, such as:\n• "How to register a new farmer?"\n• "How to record intake and create batches?"\n• "How to grade produce?"\n• "How to create a marketplace listing?"\n• "How to fulfill and dispatch orders?"\n• "How to process farmer payouts?"\n• "How to create procurement plans & buyer demand?"\n• "How to create shipments?"\n• "How to check Mandi price intelligence?"\n• "How to generate and print PDF reports?"\n\nOr ask live questions like "How much do we owe farmers?" or "What is our current stock?"`;
    }

    return res.json({
      type: 'GENERAL',
      answer: generalAnswer,
      operationsList: OPERATIONS_CATALOG.map((o) => ({ id: o.id, title: o.title, category: o.category, navTab: o.navTab })),
      generatedBy: 'FarmFresh Operations Assistant',
      asOf: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Operations Assistant error:', e);
    res.status(500).json({ message: 'Unable to answer the operations question.' });
  }
};

exports.operationsCatalog = async (req, res) => {
  try {
    res.json({ operations: OPERATIONS_CATALOG });
  } catch (e) {
    res.status(500).json({ message: 'Unable to load operations catalog.' });
  }
};

exports.documentData = async (req,res)=>{
  try { const fpo=await getFpoId(req.user._id||req.user.id); if(!fpo)return res.status(404).json({message:'FPO profile not found.'}); const type=String(req.params.type||'').toLowerCase(); if(!['payout-statement','inventory-report','cash-flow-report','reconciliation-report'].includes(type))return res.status(400).json({message:'Unsupported document type.'}); const data=await buildDocumentData(fpo,type); res.json(data); } catch(e){res.status(500).json({message:'Unable to generate document data.'});}
};
async function buildDocumentData(fpo,type){
  const [farmers,batches,inventory,payouts,tx,movements]=await Promise.all([Farmer.find({fpo:fpo._id}).select('name memberId').lean(),Batch.find({fpo:fpo._id}).select('batchId produceType rawQuantityKg amountOwedToFarmer payoutStatus').lean(),Inventory.find({fpo:fpo._id}).lean(),Payout.find({fpo:fpo._id}).populate('farmer','name memberId').sort({createdAt:-1}).limit(500).lean(),PaymentTransaction.find({fpo:fpo._id}).select('transactionId fpoAmount status createdAt').sort({createdAt:-1}).limit(500).lean(),StockMovement.find({fpo:fpo._id}).sort({createdAt:-1}).limit(1000).lean()]);
  const title={ 'payout-statement':'Farmer Payout Statement','inventory-report':'FPO Inventory Report','cash-flow-report':'FPO Cash Flow Report','reconciliation-report':'FPO Reconciliation Report'}[type];
  if(type==='payout-statement') return {title,generatedAt:new Date().toISOString(),fpo:{name:fpo.name,registrationNumber:fpo.registrationNumber},rows:payouts.map(p=>({farmer:p.farmer?.name||'—',memberId:p.farmer?.memberId||'—',amount:Number(p.amount??p.totalAmount??0),status:p.status,fundedFrom:p.fundedFrom,transactionId:p.transactionId||'—',date:p.paidAt||p.paymentDate||p.createdAt}))};
  if(type==='inventory-report') return {title,generatedAt:new Date().toISOString(),fpo:{name:fpo.name,registrationNumber:fpo.registrationNumber},rows:inventory.map(i=>({produceType:i.produceType,grade:i.grade,totalQuantityKg:Number(i.totalQuantity||0),reservedKg:Number(i.reservedQuantity||0),soldKg:Number(i.soldQuantity||0)}))};
  if(type==='cash-flow-report'){const receive=tx.filter(x=>x.status==='Success').reduce((s,x)=>s+Number(x.fpoAmount||0),0);const pay=payouts.filter(x=>x.status==='Pending').reduce((s,x)=>s+Number(x.amount??x.totalAmount??0),0);return {title,generatedAt:new Date().toISOString(),fpo:{name:fpo.name,registrationNumber:fpo.registrationNumber},totals:{moneyToReceive:round2(receive),moneyToPay:round2(pay),netPosition:round2(receive-pay)}};}
  return {title,generatedAt:new Date().toISOString(),fpo:{name:fpo.name,registrationNumber:fpo.registrationNumber},inventoryMovements:movements.length,inventoryLines:inventory.length,batches:batches.length};
}

exports.adminCbbo = async (req,res)=>{
  try {
    const [fpos, farmers, batches, inventory, orders, payouts] = await Promise.all([Fpo.find({}).select('name cbboName contactDetails shareholderFarmerCount kycStatus').lean(), Farmer.find({}).select('fpo isActive').lean(), Batch.find({}).select('fpo rawQuantityKg').lean(), Inventory.find({}).select('fpo totalQuantity').lean(), FpoOrder.find({}).select('fpo fpoAmount totalPrice quantityKg status').lean(), Payout.find({}).select('fpo amount totalAmount status').lean()]);
    const byFpo = new Map();
    fpos.forEach(f=>byFpo.set(String(f._id),{fpoId:f._id,name:f.name,cbboName:f.cbboName||'Unassigned',state:f.contactDetails?.state||'',district:f.contactDetails?.district||'',kycStatus:f.kycStatus,farmers:0,activeFarmers:0,produceKg:0,inventoryKg:0,sales:0,orders:0,paidToFarmers:0}));
    farmers.forEach(x=>{const r=byFpo.get(String(x.fpo));if(r){r.farmers++;if(x.isActive)r.activeFarmers++;}}); batches.forEach(x=>{const r=byFpo.get(String(x.fpo));if(r)r.produceKg+=Number(x.rawQuantityKg||0);}); inventory.forEach(x=>{const r=byFpo.get(String(x.fpo));if(r)r.inventoryKg+=Number(x.totalQuantity||0);}); orders.forEach(x=>{const r=byFpo.get(String(x.fpo));if(r){r.sales+=Number(x.fpoAmount||x.totalPrice||0);r.orders++;}}); payouts.forEach(x=>{const r=byFpo.get(String(x.fpo));if(r&&x.status==='Completed')r.paidToFarmers+=Number(x.amount??x.totalAmount??0);});
    const rows=Array.from(byFpo.values()).map(r=>({...r,produceKg:round1(r.produceKg),inventoryKg:round1(r.inventoryKg),sales:round2(r.sales),paidToFarmers:round2(r.paidToFarmers)}));
    const groups={}; rows.forEach(r=>{if(!groups[r.cbboName])groups[r.cbboName]={cbboName:r.cbboName,fpos:0,farmers:0,produceKg:0,sales:0,paidToFarmers:0};const g=groups[r.cbboName];g.fpos++;g.farmers+=r.farmers;g.produceKg+=r.produceKg;g.sales+=r.sales;g.paidToFarmers+=r.paidToFarmers;});
    res.json({totals:{fpos:rows.length,farmers:rows.reduce((s,r)=>s+r.farmers,0),produceKg:round1(rows.reduce((s,r)=>s+r.produceKg,0)),inventoryKg:round1(rows.reduce((s,r)=>s+r.inventoryKg,0)),sales:round2(rows.reduce((s,r)=>s+r.sales,0)),paidToFarmers:round2(rows.reduce((s,r)=>s+r.paidToFarmers,0))},byCbbo:Object.values(groups).map(g=>({...g,produceKg:round1(g.produceKg),sales:round2(g.sales),paidToFarmers:round2(g.paidToFarmers)})),fpos:rows});
  } catch(e){res.status(500).json({message:'Unable to load CBBO dashboard.'});}
};

exports.adminReconciliation = async (req,res)=>{
  try {
    const fpos=await Fpo.find({}).select('name').lean(); const results=[];
    for(const fpo of fpos){const [inventory,movements,batches,orders,payouts]=await Promise.all([Inventory.find({fpo:fpo._id}).lean(),StockMovement.find({fpo:fpo._id}).lean(),Batch.find({fpo:fpo._id}).select('rawQuantityKg amountOwedToFarmer').lean(),FpoOrder.find({fpo:fpo._id}).select('quantityKg').lean(),Payout.find({fpo:fpo._id,status:'Pending'}).select('amount totalAmount').lean()]);const rec=await buildReconciliation(fpo._id,inventory,movements,batches,orders,payouts);results.push({fpoId:fpo._id,name:fpo.name,...rec});} res.json({generatedAt:new Date().toISOString(),issues:results.filter(x=>x.inventoryIssues>0),results});
  }catch(e){res.status(500).json({message:'Unable to run platform reconciliation.'});}
};