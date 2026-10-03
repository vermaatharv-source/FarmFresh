'use strict';

const Batch = require('../models/Batch');
const Payout = require('../models/Payout');
const FpoOrder = require('../models/FpoOrder');
const PaymentTransaction = require('../models/PaymentTransaction');
const Farmer = require('../models/Farmer');
const { complianceSnapshot } = require('./complianceService');

const DAY_MS = 86400000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ACTIVE_ORDER_STATUSES = new Set(['Placed', 'Accepted', 'Packed', 'Dispatched']);
const MAX_RANGE_DAYS = 1100;
const MAX_LEDGER_ROWS = 5000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (v) => Math.round(num(v) * 100) / 100;
const idStr = (v) => (v === undefined || v === null ? '' : String(v._id || v));
const payoutAmount = (p) => num(p.amount ?? p.totalAmount);
const payoutDate = (p) => p.paidAt || p.paymentDate || p.createdAt;
const inr = (n) => Math.round(num(n)).toLocaleString('en-IN');

// 'YYYY-MM-DD' of a moment in Indian Standard Time ('' if the date is invalid).
const istKey = (d) => {
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return '';
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
};

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// Validates a YYYY-MM-DD string, including impossible dates such as 2026-02-31.
function startOfIstDay(key) {
  const d = new Date(`${key}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) || istKey(d) !== key ? null : d;
}

// Default period: the Indian financial year (1 Apr onwards) up to today.
function parseRange(from, to, now = new Date()) {
  const toKey = DATE_RE.test(String(to || '')) ? String(to) : istKey(now);
  let fromKey = DATE_RE.test(String(from || '')) ? String(from) : '';
  if (!fromKey) {
    const year = Number(toKey.slice(0, 4));
    const month = Number(toKey.slice(5, 7));
    fromKey = `${month >= 4 ? year : year - 1}-04-01`;
  }
  const start = startOfIstDay(fromKey);
  const endDay = startOfIstDay(toKey);
  if (!start || !endDay) throw badRequest('Invalid date. Use real calendar dates in YYYY-MM-DD format.');
  const end = new Date(endDay.getTime() + DAY_MS - 1);
  if (start > end) throw badRequest('The start date must be on or before the end date.');
  if ((end - start) / DAY_MS > MAX_RANGE_DAYS) throw badRequest('Please choose a period of 3 years or less.');
  return { fromKey, toKey, start, end };
}

const inRange = (d, start, end) => {
  const t = new Date(d).getTime();
  return Number.isFinite(t) && t >= start.getTime() && t <= end.getTime();
};

/**
 * Working-capital picture for one FPO, built only from data the app already stores.
 *
 * A refunded payment is the SAME PaymentTransaction document flipped to status "Refunded", so:
 *   gross receipts = Success + Refunded,  refunds = Refunded,  net earnings = Success.
 */
async function buildCashFlow(fpo, now = new Date()) {
  const fpoId = fpo._id;
  const [txns, payouts, orders, openBatches] = await Promise.all([
    PaymentTransaction.find({ fpo: fpoId, status: { $in: ['Success', 'Refunded'] } })
      .select('order fpoAmount status createdAt refundedAt').lean(),
    Payout.find({ fpo: fpoId, status: { $in: ['Pending', 'Completed'] } })
      .select('amount totalAmount fundedFrom status paidAt paymentDate createdAt').lean(),
    FpoOrder.find({ fpo: fpoId }).select('status paymentMethod').lean(),
    Batch.find({
      fpo: fpoId,
      'grading.status': 'Approved',
      payoutStatus: { $ne: 'PAID' },
      amountOwedToFarmer: { $gt: 0 },
    })
      .populate('farmer', 'name village')
      .select('batchId farmer produceType amountOwedToFarmer grading collectionDate createdAt')
      .lean(),
  ]);

  const orderMap = new Map(orders.map((o) => [idStr(o._id), o]));

  // ---- Marketplace money, classified by what has happened to the linked order ----
  let received = 0;
  let refunds = 0;
  let settled = 0;
  let prepaidInTransit = 0;
  let codToCollect = 0;
  let activeCount = 0;
  txns.forEach((t) => {
    const a = num(t.fpoAmount);
    received += a;
    if (t.status === 'Refunded') {
      refunds += a;
      return;
    }
    const o = orderMap.get(idStr(t.order));
    if (o && ACTIVE_ORDER_STATUSES.has(o.status)) {
      activeCount += 1;
      if (o.paymentMethod === 'COD') codToCollect += a;
      else prepaidInTransit += a;
    } else {
      settled += a;
    }
  });
  const netEarnings = received - refunds;
  const collected = settled + prepaidInTransit; // cash actually received (COD still at the door is excluded)

  // ---- Payouts to farmers ----
  const completed = payouts.filter((p) => p.status === 'Completed');
  const cashPayouts = completed.filter((p) => p.fundedFrom !== 'CREDIT_LINE').reduce((s, p) => s + payoutAmount(p), 0);
  const creditPayouts = completed.filter((p) => p.fundedFrom === 'CREDIT_LINE').reduce((s, p) => s + payoutAmount(p), 0);
  const creditLimit = num(fpo.creditLineAvailable);
  const creditDrawn = payouts.filter((p) => p.fundedFrom === 'CREDIT_LINE').reduce((s, p) => s + payoutAmount(p), 0);
  const creditHeadroom = Math.max(0, creditLimit - creditDrawn);
  const netCash = collected - cashPayouts;

  // ---- Last 30 days (IST calendar days, oldest first) ----
  const dayKeys = [];
  for (let i = 29; i >= 0; i -= 1) dayKeys.push(istKey(new Date(now.getTime() - i * DAY_MS)));
  const inMap = {};
  const outMap = {};
  const addTo = (map, key, amount) => {
    if (key) map[key] = (map[key] || 0) + amount;
  };
  txns.forEach((t) => {
    addTo(inMap, istKey(t.createdAt), num(t.fpoAmount));
    if (t.status === 'Refunded') addTo(outMap, istKey(t.refundedAt || t.createdAt), num(t.fpoAmount));
  });
  completed.forEach((p) => addTo(outMap, istKey(payoutDate(p)), payoutAmount(p)));
  const daily = dayKeys.map((date) => ({ date, inflow: r2(inMap[date]), outflow: r2(outMap[date]) }));
  const last30 = {
    in: r2(daily.reduce((s, d) => s + d.inflow, 0)),
    out: r2(daily.reduce((s, d) => s + d.outflow, 0)),
  };

  // ---- Payables: graded batches the FPO has not yet paid for, aged from grading ----
  const ageOf = (b) => {
    const from = b.grading?.gradedAt || b.collectionDate || b.createdAt;
    const t = new Date(from).getTime();
    return Number.isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / DAY_MS)) : 0;
  };
  const bucketDefs = [
    { key: '0-7', label: '0–7 days', test: (a) => a <= 7 },
    { key: '8-15', label: '8–15 days', test: (a) => a > 7 && a <= 15 },
    { key: '16-30', label: '16–30 days', test: (a) => a > 15 && a <= 30 },
    { key: '31+', label: 'Over 30 days', test: () => true },
  ];
  const buckets = bucketDefs.map((d) => ({ key: d.key, label: d.label, amount: 0, count: 0 }));
  const farmerMap = new Map();
  let payablesTotal = 0;
  let overdue15 = 0;
  let overdue30 = 0;
  openBatches.forEach((b) => {
    const amt = num(b.amountOwedToFarmer);
    const age = ageOf(b);
    payablesTotal += amt;
    if (age > 15) overdue15 += amt;
    if (age > 30) overdue30 += amt;
    const idx = bucketDefs.findIndex((d) => d.test(age));
    buckets[idx].amount += amt;
    buckets[idx].count += 1;
    const fid = idStr(b.farmer) || 'unknown';
    const cur = farmerMap.get(fid) || {
      farmerId: fid,
      name: b.farmer?.name || 'Unknown farmer',
      village: b.farmer?.village || '',
      owed: 0,
      batches: 0,
      oldestDays: 0,
    };
    cur.owed += amt;
    cur.batches += 1;
    cur.oldestDays = Math.max(cur.oldestDays, age);
    farmerMap.set(fid, cur);
  });
  const topFarmers = [...farmerMap.values()]
    .sort((a, b) => b.owed - a.owed)
    .slice(0, 8)
    .map((f) => ({ ...f, owed: r2(f.owed) }));

  // ---- Can the FPO cover what it owes? (marketplace data only) ----
  const marketplaceCash = Math.max(0, netCash);
  const available = marketplaceCash + codToCollect + creditHeadroom;
  let status = 'clear';
  let coverage = null;
  let shortfall = 0;
  if (payablesTotal > 0) {
    coverage = available / payablesTotal;
    shortfall = Math.max(0, payablesTotal - available);
    status = coverage < 1 ? 'shortfall' : coverage < 1.5 ? 'tight' : 'healthy';
  }

  // ---- Alerts ----
  const alerts = [];
  if (overdue30 > 0) {
    alerts.push({ level: 'danger', text: `₹${inr(overdue30)} has been owed to farmers for more than 30 days (${buckets[3].count} batch${buckets[3].count === 1 ? '' : 'es'}). Pay these first.` });
  } else if (overdue15 > 0) {
    alerts.push({ level: 'warn', text: `₹${inr(overdue15)} has been owed to farmers for more than 15 days.` });
  }
  if (status === 'shortfall') {
    alerts.push({ level: 'danger', text: `Marketplace cash, COD still to collect and unused credit line together fall ₹${inr(shortfall)} short of what you owe farmers.` });
  } else if (status === 'tight') {
    alerts.push({ level: 'warn', text: 'Cover for farmer payments is tight: available funds are under 1.5× what you owe.' });
  }
  if (creditLimit > 0 && creditHeadroom / creditLimit < 0.2) {
    alerts.push({ level: 'warn', text: `Credit line is ${Math.round((creditDrawn / creditLimit) * 100)}% used.` });
  }
  if (codToCollect > 0) {
    alerts.push({ level: 'info', text: `₹${inr(codToCollect)} in Cash on Delivery orders is still to be collected at the door.` });
  }
  if (prepaidInTransit > 0) {
    alerts.push({ level: 'info', text: `₹${inr(prepaidInTransit)} was paid online for orders not yet delivered. It may be refunded if an order is cancelled.` });
  }

  return {
    generatedAt: now.toISOString(),
    summary: {
      grossReceipts: r2(received),
      refunds: r2(refunds),
      netEarnings: r2(netEarnings),
      collected: r2(collected),
      cashPayouts: r2(cashPayouts),
      creditPayouts: r2(creditPayouts),
      totalPaidToFarmers: r2(cashPayouts + creditPayouts),
      netCash: r2(netCash),
      creditLimit: r2(creditLimit),
      creditDrawn: r2(creditDrawn),
      creditHeadroom: r2(creditHeadroom),
      last30,
    },
    receivables: {
      settled: r2(settled),
      prepaidInTransit: r2(prepaidInTransit),
      codToCollect: r2(codToCollect),
      refunded: r2(refunds),
      activeCount,
    },
    payables: {
      total: r2(payablesTotal),
      count: openBatches.length,
      overdue15: r2(overdue15),
      overdue30: r2(overdue30),
      buckets: buckets.map((b) => ({ ...b, amount: r2(b.amount) })),
      topFarmers,
    },
    projection: {
      marketplaceCash: r2(marketplaceCash),
      codToCollect: r2(codToCollect),
      creditHeadroom: r2(creditHeadroom),
      available: r2(available),
      payables: r2(payablesTotal),
      coverage: coverage === null ? null : Math.round(coverage * 100) / 100,
      status,
      shortfall: r2(shortfall),
    },
    daily,
    alerts,
  };
}

/**
 * Bank / CA / CBBO-ready pack for a chosen period: summary tables plus a chronological cash ledger.
 * Farmer NAMES are intentionally not included; payees appear as member IDs.
 */
async function buildBankPack(fpo, fromInput, toInput, now = new Date()) {
  const { fromKey, toKey, start, end } = parseRange(fromInput, toInput, now);
  const fpoId = fpo._id;

  const [farmers, batches, txnsAll, payoutsAll, orders, compliance, position] = await Promise.all([
    Farmer.find({ fpo: fpoId }).select('isActive isShareholder').lean(),
    Batch.find({ fpo: fpoId, collectionDate: { $gte: start, $lte: end } })
      .select('produceType rawQuantityKg grading amountOwedToFarmer payoutStatus collectionDate').lean(),
    PaymentTransaction.find({
      fpo: fpoId,
      status: { $in: ['Success', 'Refunded'] },
      $or: [{ createdAt: { $gte: start, $lte: end } }, { refundedAt: { $gte: start, $lte: end } }],
    }).select('transactionId order paymentMethod fpoAmount status createdAt refundedAt refundTransactionId').lean(),
    Payout.find({ fpo: fpoId, status: 'Completed' })
      .populate('farmer', 'memberId')
      .populate('batch', 'batchId')
      .select('farmer batch amount totalAmount paymentMethod fundedFrom transactionId paidAt paymentDate createdAt').lean(),
    FpoOrder.find({ fpo: fpoId, createdAt: { $gte: start, $lte: end } }).select('status').lean(),
    complianceSnapshot(fpoId, now),
    buildCashFlow(fpo, now),
  ]);

  // ---- Receipts and refunds inside the period ----
  const receiptTxns = txnsAll.filter((t) => inRange(t.createdAt, start, end));
  const refundTxns = txnsAll.filter((t) => t.status === 'Refunded' && inRange(t.refundedAt || t.createdAt, start, end));
  const receipts = receiptTxns.reduce((s, t) => s + num(t.fpoAmount), 0);
  const refunds = refundTxns.reduce((s, t) => s + num(t.fpoAmount), 0);

  // ---- Payouts inside the period ----
  const payouts = payoutsAll.filter((p) => inRange(payoutDate(p), start, end));
  const payoutTotal = payouts.reduce((s, p) => s + payoutAmount(p), 0);
  const byMethod = {};
  const byFunding = {};
  const farmersPaid = new Set();
  payouts.forEach((p) => {
    const m = p.paymentMethod || 'BANK_TRANSFER';
    const f = p.fundedFrom || 'FPO_CASH';
    byMethod[m] = r2((byMethod[m] || 0) + payoutAmount(p));
    byFunding[f] = r2((byFunding[f] || 0) + payoutAmount(p));
    if (p.farmer) farmersPaid.add(idStr(p.farmer));
  });

  // ---- Monthly table (IST months) ----
  const months = {};
  const month = (key) => {
    const k = key.slice(0, 7);
    if (!months[k]) months[k] = { month: k, receipts: 0, refunds: 0, payouts: 0 };
    return months[k];
  };
  receiptTxns.forEach((t) => { const k = istKey(t.createdAt); if (k) month(k).receipts += num(t.fpoAmount); });
  refundTxns.forEach((t) => { const k = istKey(t.refundedAt || t.createdAt); if (k) month(k).refunds += num(t.fpoAmount); });
  payouts.forEach((p) => { const k = istKey(payoutDate(p)); if (k) month(k).payouts += payoutAmount(p); });
  const monthly = Object.values(months)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, receipts: r2(m.receipts), refunds: r2(m.refunds), payouts: r2(m.payouts), net: r2(m.receipts - m.refunds - m.payouts) }));

  // ---- Procurement by produce ----
  const produce = {};
  let intakeKg = 0;
  let gradeAKg = 0;
  batches.forEach((b) => {
    const name = String(b.produceType || 'Unknown').trim() || 'Unknown';
    const key = name.toLowerCase();
    if (!produce[key]) produce[key] = { produceType: name, batches: 0, intakeKg: 0, gradeAKg: 0, gradeBKg: 0, gradeCKg: 0, farmerValue: 0 };
    const row = produce[key];
    row.batches += 1;
    row.intakeKg += num(b.rawQuantityKg);
    row.gradeAKg += num(b.grading?.gradeA_Kg);
    row.gradeBKg += num(b.grading?.gradeB_Kg);
    row.gradeCKg += num(b.grading?.gradeC_Kg);
    if (b.grading?.status === 'Approved') row.farmerValue += num(b.amountOwedToFarmer);
    intakeKg += num(b.rawQuantityKg);
    gradeAKg += num(b.grading?.gradeA_Kg);
  });
  const byProduce = Object.values(produce)
    .sort((a, b) => b.intakeKg - a.intakeKg)
    .map((p) => ({
      ...p,
      intakeKg: r2(p.intakeKg),
      gradeAKg: r2(p.gradeAKg),
      gradeBKg: r2(p.gradeBKg),
      gradeCKg: r2(p.gradeCKg),
      farmerValue: r2(p.farmerValue),
    }));

  const ordersByStatus = {};
  orders.forEach((o) => { ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1; });

  // ---- Ledger ----
  const ledger = [];
  receiptTxns.forEach((t) => ledger.push({
    ts: new Date(t.createdAt).getTime(),
    type: 'Marketplace receipt',
    reference: t.transactionId || '',
    details: `Order …${idStr(t.order).slice(-6)}`,
    method: t.paymentMethod || '',
    fundedFrom: '',
    inflow: r2(t.fpoAmount),
    outflow: 0,
  }));
  refundTxns.forEach((t) => ledger.push({
    ts: new Date(t.refundedAt || t.createdAt).getTime(),
    type: 'Refund to buyer',
    reference: t.refundTransactionId || t.transactionId || '',
    details: `Order …${idStr(t.order).slice(-6)}`,
    method: t.paymentMethod || '',
    fundedFrom: '',
    inflow: 0,
    outflow: r2(t.fpoAmount),
  }));
  payouts.forEach((p) => {
    const memberId = p.farmer?.memberId ? `Member ${p.farmer.memberId}` : `Farmer …${idStr(p.farmer).slice(-4)}`;
    ledger.push({
      ts: new Date(payoutDate(p)).getTime(),
      type: 'Farmer payout',
      reference: p.transactionId || '',
      details: `${memberId}${p.batch?.batchId ? ` · Batch ${p.batch.batchId}` : ''}`,
      method: p.paymentMethod || '',
      fundedFrom: p.fundedFrom || 'FPO_CASH',
      inflow: 0,
      outflow: payoutAmount(p),
    });
  });
  ledger.sort((a, b) => a.ts - b.ts);
  const ledgerTruncated = ledger.length > MAX_LEDGER_ROWS;
  let running = 0;
  const ledgerRows = ledger.slice(0, MAX_LEDGER_ROWS).map((row) => {
    running += row.inflow - row.outflow;
    return {
      date: istKey(row.ts),
      type: row.type,
      reference: row.reference,
      details: row.details,
      method: row.method,
      fundedFrom: row.fundedFrom,
      inflow: r2(row.inflow),
      outflow: r2(row.outflow),
      net: r2(running),
    };
  });

  const c = fpo.contactDetails || {};
  return {
    generatedAt: now.toISOString(),
    period: { from: fromKey, to: toKey },
    disclaimer: [
      'Generated by FarmFresh from the FPO’s own records. It has not been audited and has not been reconciled with bank statements.',
      'Marketplace payments are recorded in the FarmFresh ledger. Confirm receipts against the FPO’s bank account before relying on them.',
      'Compliance dates are entered by the FPO and have not been verified by FarmFresh.',
    ],
    fpo: {
      name: fpo.name || '',
      registrationType: fpo.registrationType || '',
      registrationNumber: fpo.registrationNumber || '',
      dateOfIncorporation: fpo.dateOfIncorporation || null,
      gstin: fpo.gstin || '',
      cbboName: fpo.cbboName || '',
      schemeName: fpo.schemeName || '',
      district: c.district || '',
      state: c.state || '',
      declaredShareholders: num(fpo.shareholderFarmerCount),
    },
    members: {
      registered: farmers.length,
      active: farmers.filter((f) => f.isActive !== false).length,
      shareholders: farmers.filter((f) => f.isShareholder !== false).length,
    },
    procurement: {
      batches: batches.length,
      intakeKg: r2(intakeKg),
      gradeAPct: intakeKg > 0 ? Math.round((gradeAKg / intakeKg) * 1000) / 10 : 0,
      byProduce,
    },
    sales: {
      receipts: r2(receipts),
      refunds: r2(refunds),
      net: r2(receipts - refunds),
      transactions: receiptTxns.length,
      orders: orders.length,
      ordersByStatus,
    },
    payouts: {
      total: r2(payoutTotal),
      count: payouts.length,
      farmersPaid: farmersPaid.size,
      byMethod,
      byFunding,
    },
    monthly,
    position: {
      asOf: now.toISOString(),
      payablesTotal: position.payables.total,
      payablesOver30: position.payables.overdue30,
      buckets: position.payables.buckets,
      creditLimit: position.summary.creditLimit,
      creditDrawn: position.summary.creditDrawn,
      creditHeadroom: position.summary.creditHeadroom,
      codToCollect: position.receivables.codToCollect,
    },
    compliance,
    ledger: { rows: ledgerRows, truncated: ledgerTruncated, totalRows: ledger.length },
  };
}

module.exports = { buildCashFlow, buildBankPack, parseRange, istKey };
