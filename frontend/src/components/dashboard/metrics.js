// Pure functions that turn the lists the FPO dashboard already loads into the
// numbers and series shown on the Overview. No React, no network: easy to test.
const DAY = 86400000;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const lastDays = (n, now = new Date()) =>
  Array.from({ length: n }, (_, i) => new Date(startOfDay(now).getTime() - (n - 1 - i) * DAY));

export function bucketByDay(items, dateOf, valueOf, n, now = new Date()) {
  const days = lastDays(n, now);
  const index = new Map(days.map((d, i) => [d.getTime(), i]));
  const values = new Array(n).fill(0);
  for (const it of items) {
    const t = dateOf(it);
    if (!t) continue;
    const k = startOfDay(t).getTime();
    if (index.has(k)) values[index.get(k)] += Number(valueOf(it)) || 0;
  }
  return days.map((date, i) => ({ date, value: values[i] }));
}

const sum = (arr) => arr.reduce((s, x) => s + x, 0);
export const pctChange = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

const LIVE_ORDER = (o) => !['Cancelled', 'Rejected', 'Refunded'].includes(o.status);
export const PIPELINE = ['Placed', 'Accepted', 'Packed', 'Dispatched', 'Delivered'];

export function computeFpoMetrics({
  farmers = [],
  batches = [],
  inventory = [],
  payouts = [],
  listings = [],
  orders = [],
  logs = [],
  priceConfigs = [],
  profile = null,
  now = new Date(),
} = {}) {
  // ---- farmers
  const women = farmers.filter((f) => f.gender === 'Female').length;
  const genderRecorded = farmers.filter((f) => f.gender).length;
  const farmersM = {
    total: farmers.length,
    active: farmers.filter((f) => f.isActive !== false).length,
    verified: farmers.filter((f) => f.isVerified).length,
    women,
    womenPct: genderRecorded ? (women / genderRecorded) * 100 : null,
    landAcres: sum(farmers.map((f) => Number(f.landHoldingAcres) || 0)),
  };

  // ---- procurement (kg per day)
  const procSeries60 = bucketByDay(batches, (b) => b.collectionDate || b.createdAt, (b) => b.rawQuantityKg, 60, now);
  const procCur = sum(procSeries60.slice(30).map((d) => d.value));
  const procPrev = sum(procSeries60.slice(0, 30).map((d) => d.value));
  const procurement = {
    series: procSeries60.slice(30),
    kg30: procCur,
    change: pctChange(procCur, procPrev),
    totalKg: sum(batches.map((b) => Number(b.rawQuantityKg) || 0)),
    batchCount: batches.length,
  };

  // ---- sales (rupees per day)
  const liveOrders = orders.filter(LIVE_ORDER);
  const salesSeries60 = bucketByDay(liveOrders, (o) => o.createdAt, (o) => o.totalPrice, 60, now);
  const salesCur = sum(salesSeries60.slice(30).map((d) => d.value));
  const salesPrev = sum(salesSeries60.slice(0, 30).map((d) => d.value));
  const statusCounts = {};
  orders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });
  const sales = {
    series: salesSeries60.slice(30),
    value30: salesCur,
    change: pctChange(salesCur, salesPrev),
    total: sum(liveOrders.map((o) => Number(o.totalPrice) || 0)),
    orderCount: liveOrders.length,
    statusCounts,
    pipeline: PIPELINE.map((s) => ({ label: s, value: statusCounts[s] || 0 })),
    exceptions: ['Cancelled', 'Rejected', 'Refunded'].reduce((s, k) => s + (statusCounts[k] || 0), 0),
  };

  // ---- grade quality (approved batches only)
  const approved = batches.filter((b) => b.grading && b.grading.status === 'Approved');
  const gA = sum(approved.map((b) => Number(b.grading.gradeA_Kg) || 0));
  const gB = sum(approved.map((b) => Number(b.grading.gradeB_Kg) || 0));
  const gC = sum(approved.map((b) => Number(b.grading.gradeC_Kg) || 0));
  const gTotal = gA + gB + gC;
  const grades = { A: gA, B: gB, C: gC, total: gTotal, aPct: gTotal ? (gA / gTotal) * 100 : null, gradedBatches: approved.length };

  // ---- top produce by volume
  const byProduce = {};
  batches.forEach((b) => {
    const k = b.produceType || 'Other';
    byProduce[k] = (byProduce[k] || 0) + (Number(b.rawQuantityKg) || 0);
  });
  const topProduce = Object.entries(byProduce)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // ---- payouts to farmers
  const paidList = payouts.filter((p) => p.status === 'Completed');
  const paid = sum(paidList.map((p) => Number(p.amount) || 0));
  const unpaidBatches = approved.filter((b) => b.payoutStatus !== 'PAID');
  const pendingAmount = sum(unpaidBatches.map((b) => Number(b.amountOwedToFarmer) || 0));
  const payoutM = {
    paid,
    paidCount: paidList.length,
    pending: pendingAmount,
    pendingCount: unpaidBatches.length,
    sharePct: sales.total > 0 ? (paid / sales.total) * 100 : null,
    series: bucketByDay(paidList, (p) => p.paidAt || p.paymentDate || p.createdAt, (p) => p.amount, 30, now),
  };

  // ---- stock
  const stockItems = inventory.map((i) => ({
    name: i.produceType,
    grade: i.grade,
    qty: Number(i.totalQuantity) || 0,
    threshold: Number(i.minAlertThreshold) || 0,
    low: (Number(i.totalQuantity) || 0) <= (Number(i.minAlertThreshold) || 0),
  }));
  const stockByCrop = {};
  stockItems.forEach((s) => {
    stockByCrop[s.name] = stockByCrop[s.name] || { label: s.name, value: 0, low: false };
    stockByCrop[s.name].value += s.qty;
    if (s.low) stockByCrop[s.name].low = true;
  });
  const stock = {
    items: stockItems,
    byCrop: Object.values(stockByCrop).sort((a, b) => b.value - a.value).slice(0, 6),
    lowItems: stockItems.filter((s) => s.low),
    totalKg: sum(stockItems.map((s) => s.qty)),
  };

  // ---- price vs mandi
  const pricing = priceConfigs
    .filter((c) => c.isActive !== false)
    .map((c) => {
      const ref = Number(c.referenceMarketPrice) || 0;
      return {
        crop: c.cropName,
        A: c.gradeAPricePerKg,
        B: c.gradeBPricePerKg,
        C: c.gradeCPricePerKg,
        ref,
        auto: c.pricingSource === 'AUTO_MANDI',
        vsRef: ref > 0 ? ((Number(c.gradeAPricePerKg) - ref) / ref) * 100 : null,
      };
    });

  // ---- listings
  const listingM = {
    published: listings.filter((l) => l.status === 'Published').length,
    draft: listings.filter((l) => l.status === 'Draft').length,
  };

  // ---- readiness checklist
  const p = profile || {};
  const c = p.contactDetails || {};
  const readiness = [
    { label: 'Registration details complete', done: Boolean(p.registrationNumber && p.registrationType && p.pan && c.address && c.district && c.state), tab: 'completion' },
    { label: 'KYC documents uploaded', done: (p.kycDocuments || []).length > 0, tab: 'settings' },
    { label: 'KYC verified by the authority', done: p.kycStatus === 'Verified', tab: 'settings' },
    { label: 'Farmers registered', done: farmers.length > 0, tab: 'farmers' },
    { label: 'Grade prices configured', done: priceConfigs.length > 0, tab: 'completion' },
    { label: 'Produce graded', done: approved.length > 0, tab: 'intake' },
    { label: 'Listing published', done: listingM.published > 0, tab: 'listings' },
    { label: 'First farmer payout completed', done: paidList.length > 0, tab: 'payouts' },
  ];
  const doneCount = readiness.filter((r) => r.done).length;

  // ---- needs attention
  const attention = [];
  if (p.kycStatus && p.kycStatus !== 'Verified') {
    attention.push({ level: 'high', text: p.kycStatus === 'Rejected' ? 'KYC was rejected. Read the reason and re-upload.' : 'KYC is awaiting the authority. Listings and payouts stay locked until it is verified.', tab: 'settings', label: 'Open KYC' });
  }
  const toGrade = batches.filter((b) => !b.grading || b.grading.status === 'Pending').length;
  if (toGrade) attention.push({ level: 'med', text: `${toGrade} batch${toGrade > 1 ? 'es' : ''} waiting to be graded`, tab: 'intake', label: 'Grade now' });
  const newOrders = orders.filter((o) => o.status === 'Placed').length;
  if (newOrders) attention.push({ level: 'high', text: `${newOrders} new order${newOrders > 1 ? 's' : ''} waiting for you to accept`, tab: 'orders', label: 'View orders' });
  const toShip = orders.filter((o) => o.status === 'Accepted' || o.status === 'Packed').length;
  if (toShip) attention.push({ level: 'med', text: `${toShip} order${toShip > 1 ? 's' : ''} to pack or dispatch`, tab: 'orders', label: 'View orders' });
  if (stock.lowItems.length) attention.push({ level: 'med', text: `Low stock: ${stock.lowItems.slice(0, 3).map((s) => `${s.name} ${s.grade}`).join(', ')}${stock.lowItems.length > 3 ? '...' : ''}`, tab: 'inventory', label: 'Inventory' });
  if (unpaidBatches.length) attention.push({ level: 'med', text: `${unpaidBatches.length} graded batch${unpaidBatches.length > 1 ? 'es' : ''} unpaid (about ${Math.round(pendingAmount).toLocaleString('en-IN')} rupees owed to farmers)`, tab: 'payouts', label: 'Pay farmers' });
  if (listingM.draft) attention.push({ level: 'low', text: `${listingM.draft} draft listing${listingM.draft > 1 ? 's' : ''} not published yet`, tab: 'listings', label: 'Listings' });
  const order = { high: 0, med: 1, low: 2 };
  attention.sort((a, b) => order[a.level] - order[b.level]);

  // ---- activity + traceability
  const sortedBatches = [...batches].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const auditWeek = logs.filter((l) => now - new Date(l.createdAt) < 7 * DAY).length;

  return {
    farmers: farmersM,
    procurement,
    sales,
    grades,
    topProduce,
    payouts: payoutM,
    stock,
    pricing,
    listings: listingM,
    readiness: { items: readiness, done: doneCount, total: readiness.length, pct: Math.round((doneCount / readiness.length) * 100) },
    attention,
    activity: [...logs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8),
    traced: { batches: batches.length, latestBatchId: sortedBatches[0] ? sortedBatches[0].batchId : null },
    auditWeek,
    kycDocs: (p.kycDocuments || []).length,
  };
}

// ---- Authority (government) side: works on the FPO registry list ----------
export function computeAuthorityMetrics(fpos = [], now = new Date()) {
  const count = (status) => fpos.filter((f) => f.kycStatus === status).length;
  const byState = {};
  const byType = {};
  fpos.forEach((f) => {
    const st = (f.contactDetails && f.contactDetails.state) || 'Not stated';
    byState[st] = (byState[st] || 0) + 1;
    const t = f.registrationType || 'Not stated';
    byType[t] = (byType[t] || 0) + 1;
  });
  const states = Object.entries(byState).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  // registrations per month, last 6 months
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short' }), value: 0 });
  }
  fpos.forEach((f) => {
    if (!f.createdAt) return;
    const d = new Date(f.createdAt);
    const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (m) m.value += 1;
  });

  const pending = fpos.filter((f) => f.kycStatus === 'Pending');
  const queue = pending
    .map((f) => ({
      _id: f._id,
      name: f.name,
      docs: (f.kycDocuments || []).length,
      days: f.createdAt ? Math.floor((now - new Date(f.createdAt)) / DAY) : 0,
      state: f.contactDetails && f.contactDetails.state,
    }))
    .sort((a, b) => b.days - a.days);

  return {
    total: fpos.length,
    verified: count('Verified'),
    pending: pending.length,
    rejected: count('Rejected'),
    verifiedPct: fpos.length ? Math.round((count('Verified') / fpos.length) * 100) : 0,
    declaredFarmers: sum(fpos.map((f) => Number(f.shareholderFarmerCount) || 0)),
    states: states.slice(0, 8),
    stateCount: states.filter((s) => s.label !== 'Not stated').length,
    types: Object.entries(byType).map(([label, value]) => ({ label, value })),
    months,
    queue,
    noDocs: queue.filter((q) => q.docs === 0).length,
    overSevenDays: queue.filter((q) => q.days >= 7).length,
  };
}
