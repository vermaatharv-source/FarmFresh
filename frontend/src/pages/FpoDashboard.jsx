import BrandLogo from '../components/BrandLogo';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import FpoCompletionPanel from '../components/FpoCompletionPanel';
import ComplianceTracker from '../components/ComplianceTracker';
import FpoOverview from '../components/dashboard/FpoOverview';
import AutoTranslate from '../components/AutoTranslate';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useLanguage } from '../context/LanguageContext';
import { FpoPaymentReport } from '../components/dashboard/PaymentReports';
import FpoOperationsCenter from '../components/dashboard/FpoOperationsCenter';
import BuyersDemandPanel from '../components/dashboard/BuyersDemandPanel';
import FpoLocationCard from '../components/dashboard/FpoLocationCard';

const NAV = [
  { id: 'analytics', label: 'Overview', icon: '📊' },
  { id: 'operations', label: 'FPO Operations', icon: '⚡' },
  { id: 'farmers', label: 'Farmers', icon: '🌾' },
  { id: 'intake', label: 'Intake & Grading', icon: '⚖️' },
  { id: 'inventory', label: 'Inventory', icon: '🏬' },
  { id: 'listings', label: 'Listings', icon: '🏷️' },
  { id: 'orders', label: 'Orders', icon: '📦' },
  { id: 'buyers', label: 'Buyers & Demand', icon: '🛒' },
  { id: 'payouts', label: 'Payouts', icon: '💰' },
  { id: 'earnings', label: 'Marketplace Earnings', icon: '💵' },
  { id: 'reports', label: 'Reports', icon: '📑' },
  { id: 'audit', label: 'Audit Log', icon: '🛡️' },
  { id: 'settings', label: 'Profile & KYC', icon: '⚙️' },
  { id: 'completion', label: 'Compliance', icon: '📋' },
];

const kycBadge = (status) => {
  if (status === 'Verified') return 'bg-emerald-500/10 text-emerald-700 border-emerald-300';
  if (status === 'Rejected') return 'bg-red-500/10 text-red-700 border-red-300';
  return 'bg-amber-500/10 text-amber-700 border-amber-300';
};

const inputClass =
  'w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder-slate-400';
const labelClass = 'block text-xs font-semibold text-slate-700 mb-1.5';

export default function FpoDashboard() {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('analytics');
  const [fpoProfile, setFpoProfile] = useState(undefined);
  const [, setAnalytics] = useState({});
  const [farmers, setFarmers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [listings, setListings] = useState([]);
  const [fpoOrders, setFpoOrders] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Search and Filter States for enhanced UI
  const [farmerSearch, setFarmerSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [batchSearch, setBatchSearch] = useState('');

  // Farmer form (govt fields)
  const [farmerForm, setFarmerForm] = useState({
    name: '',
    phone: '',
    aadhaarNumber: '',
    village: '',
    block: '',
    district: '',
    state: '',
    address: '',
    landHoldingAcres: '',
    cropsGrown: '',
    gender: '',
    category: '',
    memberId: '',
    joiningDate: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
  });
  const [csvFile, setCsvFile] = useState(null);

  // Intake / grading / payout (kept compatible with existing APIs)
  const [intakeForm, setIntakeForm] = useState({
    farmerId: '',
    produceType: '',
    rawQuantityKg: '',
    harvestDate: '',
  });
  const [gradingForm, setGradingForm] = useState({
    batchId: '',
    gradeA_Kg: 0,
    gradeB_Kg: 0,
    gradeC_Kg: 0,
    qualityScore: 80,
    status: 'Approved',
  });
  const [payoutForm, setPayoutForm] = useState({
    farmerId: '',
    batchId: '',
    amount: '',
  });
  const [orderCooldown, setOrderCooldown] = useState({}); // orderId -> timestamp ms
  const [listingImages, setListingImages] = useState([]);
  const [lastIntakeQr, setLastIntakeQr] = useState(null);
  const [lastBatchId, setLastBatchId] = useState(null);
  const [listingForm, setListingForm] = useState({
    produceType: '',
    grade: 'A',
    pricePerKg: '',
    availableQuantityKg: '',
    minOrderQtyKg: 1,
    description: '',
    sourceBatch: '',
  });
  const [kycFiles, setKycFiles] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', location: '' });

  const flash = (t, isErr = false) => {
    if (isErr) setErr(t);
    else setMsg(t);
    setTimeout(() => {
      setMsg('');
      setErr('');
    }, 3500);
  };

  const loadProfile = useCallback(async () => {
    try {
      const res = await API.get('/fpo/profile');
      setFpoProfile(res.data);
    } catch {
      setFpoProfile(null);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [a, f, b, inv, p, l, o] = await Promise.all([
        API.get('/fpo/analytics').catch(() => ({ data: {} })),
        API.get('/fpo/farmers').catch(() => ({ data: [] })),
        API.get('/fpo/batches').catch(() => ({ data: [] })),
        API.get('/fpo/inventory').catch(() => ({ data: [] })),
        API.get('/fpo/payouts').catch(() => ({ data: [] })),
        API.get('/listings/mine').catch(() => ({ data: [] })),
        API.get('/fpo-orders/fpo').catch(() => ({ data: [] })),
      ]);
      setAnalytics(a.data || {});
      setFarmers(f.data || []);
      setBatches(b.data || []);
      setInventory(inv.data || []);
      setPayouts(p.data || []);
      setListings(l.data || []);
      setFpoOrders(o.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadAudit = async () => {
    try {
      const res = await API.get('/fpo/activity-logs');
      setActivityLogs(res.data || []);
    } catch {
      setActivityLogs([]);
    }
  };

  useEffect(() => {
    loadProfile();
    loadAll();
  }, [loadProfile, loadAll]);

  useEffect(() => {
    if (activeTab === 'audit') loadAudit();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'earnings') return;
    let cancelled = false;
    const loadPayments = async () => {
      setPaymentLoading(true);
      setPaymentError('');
      try {
        const res = await API.get('/payments/fpo/earnings');
        if (!cancelled) setPaymentData(res.data || null);
      } catch (e) {
        if (!cancelled) setPaymentError(e.response?.data?.message || 'Failed to load marketplace earnings');
      } finally {
        if (!cancelled) setPaymentLoading(false);
      }
    };
    loadPayments();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // —— Farmers ——
  const submitFarmer = async (e) => {
    e.preventDefault();
    try {
      await API.post('/fpo/farmers', {
        ...farmerForm,
        landHoldingAcres: Number(farmerForm.landHoldingAcres) || 0,
        bankDetails: {
          accountNumber: farmerForm.accountNumber,
          ifscCode: farmerForm.ifscCode,
          bankName: farmerForm.bankName,
        },
        sourceLanguage: language,
      });
      flash('Farmer successfully registered in FPO records.');
      setFarmerForm({
        name: '',
        phone: '',
        aadhaarNumber: '',
        village: '',
        block: '',
        district: '',
        state: '',
        address: '',
        landHoldingAcres: '',
        cropsGrown: '',
        gender: '',
        category: '',
        memberId: '',
        joiningDate: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
      });
      loadAll();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to add farmer', true);
    }
  };

  const importFarmers = async () => {
    if (!csvFile) return;
    const fd = new FormData();
    fd.append('file', csvFile);
    try {
      const res = await API.post('/fpo/farmers/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      flash(res.data.message || 'Import complete');
      setCsvFile(null);
      loadAll();
    } catch (e) {
      flash(e.response?.data?.message || 'Import failed', true);
    }
  };

  // —— Intake ——
  const submitIntake = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/fpo/batches/intake', {
        ...intakeForm,
        rawQuantityKg: Number(intakeForm.rawQuantityKg),
        sourceLanguage: language,
      });
      const batch = res.data?.batch || res.data;
      setLastIntakeQr(batch?.qrCodeUrl || null);
      setLastBatchId(batch?.batchId || null);
      flash(batch?.batchId ? `Intake recorded — Batch ${batch.batchId} generated!` : 'Intake recorded');
      setIntakeForm({ farmerId: '', produceType: '', rawQuantityKg: '', harvestDate: '' });
      loadAll();
    } catch (e) {
      flash(e.response?.data?.message || 'Intake failed', true);
    }
  };

  const submitGrading = async (e) => {
    e.preventDefault();
    try {
      await API.patch(`/fpo/batches/${gradingForm.batchId}/grade`, {
        gradeA_Kg: Number(gradingForm.gradeA_Kg),
        gradeB_Kg: Number(gradingForm.gradeB_Kg),
        gradeC_Kg: Number(gradingForm.gradeC_Kg),
        qualityScore: Number(gradingForm.qualityScore),
        status: gradingForm.status,
      });
      flash('Grading submitted! Stock moved into active Inventory.');
      loadAll();
    } catch (e) {
      flash(e.response?.data?.message || 'Grading failed', true);
    }
  };

  // —— Payout ——
  const submitPayout = async (e) => {
    e.preventDefault();
    if (!payoutForm.farmerId || !payoutForm.batchId) {
      flash('Select farmer and batch', true);
      return;
    }
    try {
      await API.post('/fpo/payouts', {
        farmerId: payoutForm.farmerId,
        batchId: payoutForm.batchId,
      });
      flash('Payout recorded successfully (transaction ID generated).');
      setPayoutForm({ farmerId: '', batchId: '', amount: '' });
      loadAll();
    } catch (e) {
      flash(e.response?.data?.message || 'Payout failed (KYC may be required)', true);
    }
  };

  const onPayoutFarmerChange = (farmerId) => {
    setPayoutForm({ farmerId, batchId: '', amount: '' });
  };

  const onPayoutBatchChange = (batchId) => {
    const b = batches.find((x) => x._id === batchId);
    setPayoutForm({
      ...payoutForm,
      batchId,
      amount: b ? String(b.amountOwedToFarmer || 0) : '',
    });
  };

  const updateOrderStatus = async (orderId, status) => {
    const last = orderCooldown[orderId] || 0;
    if (Date.now() - last < 30000) {
      const wait = Math.ceil((30000 - (Date.now() - last)) / 1000);
      flash(`Wait ${wait}s before next status change`, true);
      return;
    }
    try {
      await API.patch(`/fpo-orders/${orderId}/status`, { status });
      setOrderCooldown((prev) => ({ ...prev, [orderId]: Date.now() }));
      flash(`Order marked as ${status}`);
      loadAll();
    } catch (e) {
      flash(e.response?.data?.message || 'Status update failed', true);
    }
  };

  const nextStatuses = (current) => {
    const map = {
      Placed: ['Accepted', 'Rejected'],
      Accepted: ['Packed', 'Cancelled'],
      Packed: ['Dispatched', 'Cancelled'],
      Dispatched: ['Delivered'],
    };
    return map[current] || [];
  };

  // —— Listing ——
  const submitListing = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('produceType', listingForm.produceType);
      fd.append('grade', listingForm.grade);
      fd.append('pricePerKg', String(Number(listingForm.pricePerKg)));
      fd.append('availableQuantityKg', String(Number(listingForm.availableQuantityKg)));
      fd.append('minOrderQtyKg', String(Number(listingForm.minOrderQtyKg) || 1));
      if (listingForm.description) fd.append('description', listingForm.description);
      if (listingForm.sourceBatch) fd.append('sourceBatch', listingForm.sourceBatch);
      (listingImages || []).forEach((file) => fd.append('images', file));
      await API.post('/listings', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      flash('Listing created successfully!');
      setListingForm({
        produceType: '',
        grade: 'A',
        pricePerKg: '',
        availableQuantityKg: '',
        minOrderQtyKg: 1,
        description: '',
        sourceBatch: '',
      });
      setListingImages([]);
      loadAll();
    } catch (e) {
      flash(e.response?.data?.message || 'Listing failed', true);
    }
  };

  const setListingStatus = async (id, status) => {
    try {
      await API.patch(`/listings/${id}/status`, { status });
      flash(`Listing marked ${status.toLowerCase()}`);
      loadAll();
    } catch (e) {
      flash(e.response?.data?.message || 'Status update failed (KYC required to publish)', true);
    }
  };

  // —— KYC ——
  const uploadKyc = async () => {
    if (!kycFiles.length) return;
    const fd = new FormData();
    kycFiles.forEach((f) => fd.append('documents', f));
    try {
      await API.post('/fpo/kyc', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      flash('KYC documents uploaded successfully.');
      setKycFiles([]);
      loadProfile();
    } catch (e) {
      flash(e.response?.data?.message || 'KYC upload failed', true);
    }
  };

  const viewKycDocument = async (index) => {
    const win = window.open('', '_blank');
    try {
      const res = await API.get(`/fpo/kyc/documents/${index}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      if (win) win.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      if (win) win.close();
      flash('Could not open the document', true);
    }
  };

  const addStaff = async (e) => {
    e.preventDefault();
    try {
      await API.post('/fpo/staff', staffForm);
      flash('Staff member added successfully.');
      setStaffForm({ name: '', email: '', password: '', location: '' });
      loadProfile();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to add staff', true);
    }
  };

  const downloadPayoutCsv = async () => {
    try {
      const res = await API.get('/reports/payouts/download', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payout_report.csv';
      a.click();
    } catch {
      flash('Download failed', true);
    }
  };

  const printFarmerStatement = (farmer) => {
    const related = payouts.filter(
      (p) => (p.farmer?._id || p.farmer) === farmer._id || p.farmer === farmer._id
    );
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Farmer Payment Statement</title>
      <style>
        body{font-family:Arial,sans-serif;padding:36px;color:#1e293b}
        h1{font-size:20px;margin:0;color:#0f172a}
        .meta{font-size:12px;color:#64748b;margin:6px 0 20px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}
        th,td{border:1px solid #cbd5e1;padding:8px 12px;text-align:left}
        th{background:#f8fafc;font-weight:600;color:#334155}
        .foot{margin-top:28px;font-size:11px;color:#94a3b8}
        .hdr{display:flex;justify-content:space-between;border-bottom:2px solid #059669;padding-bottom:12px;margin-bottom:16px}
      </style></head><body>
      <div class="hdr">
        <div>
          <h1>${fpoProfile?.name || 'FPO'}</h1>
          <div class="meta">Reg. No: ${fpoProfile?.registrationNumber || '—'} · KYC: ${fpoProfile?.kycStatus || '—'}</div>
        </div>
        <div style="text-align:right;font-size:12px;color:#475569">Farmer Payment Statement<br/>Generated ${new Date().toLocaleDateString('en-IN')}</div>
      </div>
      <p style="font-size:13px;line-height:1.6"><strong>Farmer Name:</strong> ${farmer.name} &nbsp;|&nbsp; <strong>Phone:</strong> ${farmer.phone}<br/>
      <strong>Member ID:</strong> ${farmer.memberId || '—'} &nbsp;|&nbsp; <strong>Village:</strong> ${farmer.village || '—'}</p>
      <table><thead><tr><th>Date</th><th>Batch</th><th>Amount (₹)</th><th>Payment Method</th><th>Txn ID</th><th>Status</th></tr></thead>
      <tbody>
      ${related.length ? related.map((p) => `<tr>
        <td>${p.paidAt || p.paymentDate ? new Date(p.paidAt || p.paymentDate).toLocaleDateString('en-IN') : '—'}</td>
        <td style="font-family:monospace">${p.batch?.batchId || '—'}</td>
        <td style="font-weight:600">₹${Number(p.amount || p.totalAmount || 0).toFixed(2)}</td>
        <td>${p.paymentMethod || '—'}</td>
        <td style="font-family:monospace;font-size:11px">${p.transactionId || '—'}</td>
        <td><span style="padding:2px 8px;border-radius:9999px;font-weight:600;font-size:10px;background:#ecfdf5;color:#047857">${p.status}</span></td>
      </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:#94a3b8">No payout records found for this farmer</td></tr>'}
      </tbody></table>
      <p class="foot">This statement is system-generated for compliance and farmer records. Bank account numbers are masked for privacy.</p>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  // Filtered lists for UI
  const filteredFarmers = useMemo(() => {
    const q = farmerSearch.toLowerCase().trim();
    if (!q) return farmers;
    return farmers.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.phone?.includes(q) ||
        f.village?.toLowerCase().includes(q) ||
        f.district?.toLowerCase().includes(q) ||
        f.memberId?.toLowerCase().includes(q)
    );
  }, [farmers, farmerSearch]);

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === 'ALL') return fpoOrders;
    return fpoOrders.filter((o) => o.status === orderStatusFilter);
  }, [fpoOrders, orderStatusFilter]);

  const filteredBatches = useMemo(() => {
    const q = batchSearch.toLowerCase().trim();
    if (!q) return batches;
    return batches.filter(
      (b) =>
        b.batchId?.toLowerCase().includes(q) ||
        b.produceType?.toLowerCase().includes(q) ||
        b.payoutStatus?.toLowerCase().includes(q)
    );
  }, [batches, batchSearch]);

  if (fpoProfile === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-emerald-600 mb-4" />
        <p className="font-semibold text-slate-800 text-base">Loading FarmFresh FPO Portal…</p>
        <p className="text-xs text-slate-400 mt-1">Connecting to operational records & ledger</p>
      </div>
    );
  }

  return (
    <AutoTranslate>
      <div className="relative h-screen flex overflow-hidden bg-slate-50">
        {/* Sidebar */}
        <aside className="w-64 h-full bg-slate-900 text-slate-100 flex flex-col shrink-0 overflow-hidden shadow-xl border-r border-slate-800">
          <div className="px-5 py-5 border-b border-slate-800/80 bg-slate-950/40">
            <div className="flex items-center justify-between mb-3">
              <BrandLogo size="sm" />
            </div>
            <LanguageSwitcher className="mb-3 w-full" />
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-emerald-400">FPO Enterprise</p>
            </div>
            <h1 className="text-sm font-bold mt-1 text-white leading-snug line-clamp-1">
              {fpoProfile?.name || 'Register your FPO'}
            </h1>
            {fpoProfile?.registrationNumber && (
              <p data-no-translate className="text-[11px] text-slate-400 mt-0.5 font-mono">
                {fpoProfile.registrationNumber}
              </p>
            )}
            {fpoProfile && (
              <div className="mt-2.5">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${kycBadge(
                    fpoProfile.kycStatus
                  )}`}
                >
                  <span className="text-xs">🛡️</span> KYC {fpoProfile.kycStatus}
                </span>
              </div>
            )}
          </div>

          <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-1">
            {NAV.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/30'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm opacity-90">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'orders' && fpoOrders.filter((o) => o.status === 'Placed').length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950">
                      {fpoOrders.filter((o) => o.status === 'Placed').length}
                    </span>
                  )}
                  {item.id === 'payouts' && payouts.filter((p) => p.status === 'Pending').length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-emerald-950">
                      {payouts.filter((p) => p.status === 'Pending').length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-800 p-4 bg-slate-950/50 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-300">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full mt-2 bg-slate-800/90 hover:bg-red-950/50 hover:text-red-300 hover:border-red-800 text-slate-300 text-xs font-semibold py-2 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
            >
              <span>🚪</span> Logout
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50">
          <header className="bg-white border-b border-slate-200/90 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 text-lg">
                {NAV.find((n) => n.id === activeTab)?.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 capitalize">
                    {NAV.find((n) => n.id === activeTab)?.label}
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    FPO Portal
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage intake, quality grading, inventory, orders, and member disbursements.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {fpoProfile?.kycStatus !== 'Verified' && (
                <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3.5 py-1.5 rounded-xl font-medium flex items-center gap-2">
                  <span>⚠️</span> KYC unverified — marketplace publishing may be restricted
                </div>
              )}
              <button
                onClick={loadAll}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
                title="Refresh Portal Data"
              >
                <span>🔄</span> Sync
              </button>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-y-auto space-y-6">
            {msg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-xs">
                <span>✅</span> {msg}
              </div>
            )}
            {err && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-xs">
                <span>⚠️</span> {err}
              </div>
            )}

            {/* OVERVIEW */}
            {activeTab === 'operations' && <FpoOperationsCenter onNavigateTab={setActiveTab} />}

            {activeTab === 'buyers' && <BuyersDemandPanel />}

            {activeTab === 'analytics' && (
              <FpoOverview
                profile={fpoProfile}
                user={user}
                farmers={farmers}
                batches={batches}
                inventory={inventory}
                payouts={payouts}
                listings={listings}
                orders={fpoOrders}
                logs={activityLogs}
                onNavigate={setActiveTab}
              />
            )}

            {/* FARMERS */}
            {activeTab === 'farmers' && (
              <div className="space-y-6">
                {/* Farmer Stat Ribbon */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Registered</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">{farmers.length}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Shareholders & members</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Suppliers</p>
                    <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                      {farmers.filter((f) => f.isActive).length}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Supplied in last 90d</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Landholding</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {farmers.reduce((s, f) => s + (Number(f.landHoldingAcres) || 0), 0).toFixed(1)} <span className="text-sm font-medium">acres</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Aggregated farm area</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Verified DBT Accounts</p>
                    <p className="text-2xl font-extrabold text-blue-700 mt-1">
                      {farmers.filter((f) => f.bankDetails?.accountNumber || f.accountNumber).length}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Ready for direct payout</p>
                  </div>
                </div>

                {/* Farmer Registration Card */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <span>🌾</span> Register New Member Farmer
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Add a smallholder farmer to your FPO ledger with farm demographics and DBT bank details.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={submitFarmer} className="grid md:grid-cols-3 gap-4">
                    {[
                      ['name', 'Full name *', 'e.g. Ramesh Patil', 'text', true],
                      ['phone', 'Phone Number (10 digits) *', 'e.g. 9876543210', 'tel', true],
                      ['aadhaarNumber', 'Aadhaar Number (Masked)', '12-digit UID', 'text', false],
                      ['memberId', 'Member / Shareholder ID', 'e.g. FPO-M-104', 'text', false],
                      ['village', 'Village / Town', 'e.g. Pimpalgaon', 'text', false],
                      ['block', 'Taluka / Block', 'e.g. Niphad', 'text', false],
                      ['district', 'District', 'e.g. Nashik', 'text', false],
                      ['state', 'State', 'e.g. Maharashtra', 'text', false],
                      ['landHoldingAcres', 'Land Holding (Acres)', 'e.g. 4.5', 'number', false],
                      ['cropsGrown', 'Crops Grown (Comma separated)', 'e.g. Tomato, Onion, Wheat', 'text', false],
                      ['joiningDate', 'Joining Date', '', 'date', false],
                      ['address', 'Full Residential Address', 'House / Street details', 'text', false],
                    ].map(([k, label, placeholder, type, req]) => (
                      <div key={k}>
                        <label className={labelClass}>{label}</label>
                        <input
                          type={type}
                          step={k === 'landHoldingAcres' ? '0.1' : undefined}
                          placeholder={placeholder}
                          className={inputClass}
                          value={farmerForm[k]}
                          onChange={(e) => setFarmerForm({ ...farmerForm, [k]: e.target.value })}
                          required={req}
                        />
                      </div>
                    ))}

                    <div>
                      <label className={labelClass}>Gender</label>
                      <select
                        className={inputClass}
                        value={farmerForm.gender}
                        onChange={(e) => setFarmerForm({ ...farmerForm, gender: e.target.value })}
                      >
                        <option value="">Select Gender</option>
                        {['Male', 'Female', 'Other'].map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>Social Category</label>
                      <select
                        className={inputClass}
                        value={farmerForm.category}
                        onChange={(e) => setFarmerForm({ ...farmerForm, category: e.target.value })}
                      >
                        <option value="">Select Category</option>
                        {['General', 'OBC', 'SC', 'ST', 'Other'].map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                    {user?.role === 'fpo_admin' && (
                      <>
                        <div>
                          <label className={labelClass}>Bank Account Number</label>
                          <input
                            placeholder="e.g. 123456789012"
                            className={inputClass}
                            value={farmerForm.accountNumber}
                            onChange={(e) => setFarmerForm({ ...farmerForm, accountNumber: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>IFSC Code</label>
                          <input
                            placeholder="e.g. SBIN0001234"
                            className={inputClass}
                            value={farmerForm.ifscCode}
                            onChange={(e) => setFarmerForm({ ...farmerForm, ifscCode: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Bank Name</label>
                          <input
                            placeholder="e.g. State Bank of India"
                            className={inputClass}
                            value={farmerForm.bankName}
                            onChange={(e) => setFarmerForm({ ...farmerForm, bankName: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    <div className="md:col-span-3 pt-2">
                      <button
                        type="submit"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                      >
                        <span>✓</span> Save & Register Farmer
                      </button>
                    </div>
                  </form>
                </div>

                {/* Bulk Import Card */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <span>📊</span> Bulk Import Farmers (CSV / Excel)
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl">
                      Upload hundreds of farmer records at once. Supports columns: <code>name, phone, village, block, district, state, landHoldingAcres, crops, accountNumber, ifscCode</code>.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
                      onChange={(e) => setCsvFile(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={importFarmers}
                      disabled={!csvFile}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-5 py-2.5 rounded-xl shadow transition-all disabled:opacity-40"
                    >
                      Upload CSV
                    </button>
                  </div>
                </div>

                {/* Farmers Table */}
                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">FPO Registered Farmers ({filteredFarmers.length})</h4>
                      <p className="text-xs text-slate-400">All registered shareholder and member farmers</p>
                    </div>
                    <div className="w-72">
                      <input
                        placeholder="🔍 Search farmer, phone, village..."
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={farmerSearch}
                        onChange={(e) => setFarmerSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                        <tr>
                          <th className="text-left p-3.5 font-semibold">Farmer Name</th>
                          <th className="text-left p-3.5 font-semibold">Phone Number</th>
                          <th className="text-left p-3.5 font-semibold">Village / District</th>
                          <th className="text-left p-3.5 font-semibold">Member ID</th>
                          <th className="text-left p-3.5 font-semibold">Land (Acres)</th>
                          <th className="text-left p-3.5 font-semibold">Aadhaar (Masked)</th>
                          <th className="text-right p-3.5 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredFarmers.map((f) => (
                          <tr key={f._id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                                  {f.name?.[0]?.toUpperCase() || 'F'}
                                </div>
                                <span className="font-semibold text-slate-900">{f.name}</span>
                              </div>
                            </td>
                            <td className="p-3.5 text-slate-700 font-medium">{f.phone}</td>
                            <td className="p-3.5 text-slate-600">
                              {[f.village, f.district].filter(Boolean).join(', ') || f.address || '—'}
                            </td>
                            <td className="p-3.5 font-mono text-xs font-semibold text-slate-700">
                              {f.memberId ? (
                                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                  {f.memberId}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-3.5 text-slate-700">{f.landHoldingAcres ? `${f.landHoldingAcres} ac` : '—'}</td>
                            <td className="p-3.5 text-xs text-slate-500 font-mono">{f.aadhaarNumber || '—'}</td>
                            <td className="p-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => printFarmerStatement(f)}
                                className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold transition-all shadow-2xs"
                              >
                                🖨️ Statement
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!filteredFarmers.length && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              No farmers found matching your criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* INTAKE & GRADING */}
            {activeTab === 'intake' && (
              <div className="space-y-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Intake Form */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
                      <span>⚖️</span> Record Produce Intake
                    </h3>
                    <p className="text-xs text-slate-500 mb-5">
                      Weigh in crop delivery from a registered farmer and issue a unique Batch QR passport.
                    </p>

                    <form onSubmit={submitIntake} className="space-y-4">
                      <div>
                        <label className={labelClass}>Select Registered Farmer *</label>
                        <select
                          required
                          className={inputClass}
                          value={intakeForm.farmerId}
                          onChange={(e) => setIntakeForm({ ...intakeForm, farmerId: e.target.value })}
                        >
                          <option value="">Select farmer from directory</option>
                          {farmers.map((f) => (
                            <option key={f._id} value={f._id}>
                              {f.name} — {f.phone} ({f.village || 'No village'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={labelClass}>Produce Type *</label>
                        <input
                          required
                          placeholder="e.g. Red Onions, Organic Wheat, Basmati Rice"
                          className={inputClass}
                          value={intakeForm.produceType}
                          onChange={(e) => setIntakeForm({ ...intakeForm, produceType: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Raw Intake Weight (kg) *</label>
                        <input
                          required
                          type="number"
                          min="0.1"
                          step="0.1"
                          placeholder="e.g. 500"
                          className={inputClass}
                          value={intakeForm.rawQuantityKg}
                          onChange={(e) => setIntakeForm({ ...intakeForm, rawQuantityKg: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Harvest / Intake Date</label>
                        <input
                          type="date"
                          className={inputClass}
                          value={intakeForm.harvestDate}
                          onChange={(e) => setIntakeForm({ ...intakeForm, harvestDate: e.target.value })}
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <span>✓</span> Save Intake & Generate Batch ID
                      </button>

                      {lastIntakeQr && (
                        <div className="mt-4 p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center gap-4">
                          <img
                            src={lastIntakeQr}
                            alt="Batch QR"
                            className="w-24 h-24 bg-white border border-emerald-200 rounded-xl p-1 shadow-sm"
                          />
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                              Traceable QR Active
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm mt-1">Batch {lastBatchId}</h4>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Scan with any phone camera to trace crop journey.
                            </p>
                            {lastBatchId && (
                              <a
                                href={`/trace/${lastBatchId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block mt-2 text-xs font-semibold text-emerald-800 underline"
                              >
                                View Digital Passport →
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </form>
                  </div>

                  {/* Grading Form */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
                      <span>🔍</span> Grade Harvest Batch
                    </h3>
                    <p className="text-xs text-slate-500 mb-5">
                      Segregate raw batch weight into Grade A, B, and C stock. Graded weight automatically transfers into Inventory.
                    </p>

                    <form onSubmit={submitGrading} className="space-y-4">
                      <div>
                        <label className={labelClass}>Select Batch for Grading *</label>
                        <select
                          required
                          className={inputClass}
                          value={gradingForm.batchId}
                          onChange={(e) => setGradingForm({ ...gradingForm, batchId: e.target.value })}
                        >
                          <option value="">Select pending batch</option>
                          {batches.map((b) => (
                            <option key={b._id} value={b._id}>
                              {b.batchId} — {b.produceType} ({b.rawQuantityKg} kg)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-emerald-800 mb-1">Grade A (kg)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="Premium"
                            className={inputClass}
                            value={gradingForm.gradeA_Kg}
                            onChange={(e) => setGradingForm({ ...gradingForm, gradeA_Kg: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Grade B (kg)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="Standard"
                            className={inputClass}
                            value={gradingForm.gradeB_Kg}
                            onChange={(e) => setGradingForm({ ...gradingForm, gradeB_Kg: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-amber-800 mb-1">Grade C (kg)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="Local"
                            className={inputClass}
                            value={gradingForm.gradeC_Kg}
                            onChange={(e) => setGradingForm({ ...gradingForm, gradeC_Kg: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Quality Score (0 to 100)</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            className="flex-1 accent-emerald-600 cursor-pointer"
                            value={gradingForm.qualityScore}
                            onChange={(e) => setGradingForm({ ...gradingForm, qualityScore: e.target.value })}
                          />
                          <span className="w-14 text-center font-bold text-slate-900 text-sm px-2 py-1 bg-slate-100 rounded-lg border border-slate-200">
                            {gradingForm.qualityScore}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Batch Status</label>
                        <select
                          className={inputClass}
                          value={gradingForm.status}
                          onChange={(e) => setGradingForm({ ...gradingForm, status: e.target.value })}
                        >
                          <option value="Approved">Approved for Inventory</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <span>✓</span> Submit Grading & Update Stock
                      </button>
                    </form>
                  </div>
                </div>

                {/* Batches Table */}
                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Recorded Produce Batches ({filteredBatches.length})</h4>
                      <p className="text-xs text-slate-400">Batches with cryptographic QR passports and payout status</p>
                    </div>
                    <div className="w-72">
                      <input
                        placeholder="🔍 Search batch ID, produce..."
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={batchSearch}
                        onChange={(e) => setBatchSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                        <tr>
                          <th className="text-left p-3.5 font-semibold">Batch ID</th>
                          <th className="text-left p-3.5 font-semibold">Produce</th>
                          <th className="text-left p-3.5 font-semibold">Raw Weight</th>
                          <th className="text-left p-3.5 font-semibold">Farmer Amount</th>
                          <th className="text-left p-3.5 font-semibold">Payout Status</th>
                          <th className="text-center p-3.5 font-semibold">Traceability QR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredBatches.map((b) => (
                          <tr key={b._id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5 font-mono text-xs font-bold text-slate-900">
                              <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">
                                {b.batchId}
                              </span>
                            </td>
                            <td className="p-3.5 font-semibold text-slate-900">{b.produceType}</td>
                            <td className="p-3.5 font-medium">{b.rawQuantityKg} kg</td>
                            <td className="p-3.5 font-bold text-emerald-800">
                              ₹{Number(b.amountOwedToFarmer || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  b.payoutStatus === 'PAID'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {b.payoutStatus || 'UNPAID'}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              {b.qrCodeUrl ? (
                                <a href={`/trace/${b.batchId}`} target="_blank" rel="noreferrer" title="Click to view digital passport">
                                  <img
                                    src={b.qrCodeUrl}
                                    alt="QR"
                                    className="w-10 h-10 mx-auto border border-slate-200 rounded-lg bg-white p-0.5 hover:scale-110 transition-transform shadow-2xs"
                                  />
                                </a>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {!filteredBatches.length && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              No batches recorded yet. Record produce intake above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* INVENTORY */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Stock</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {inventory.reduce((s, x) => s + (x.totalQuantity || 0), 0).toFixed(1)} <span className="text-sm font-medium">kg</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Godown inventory</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Reserved for Orders</p>
                    <p className="text-2xl font-extrabold text-amber-700 mt-1">
                      {inventory.reduce((s, x) => s + (x.reservedQuantity || 0), 0).toFixed(1)} <span className="text-sm font-medium">kg</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Pending dispatch</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fulfilled / Sold</p>
                    <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                      {inventory.reduce((s, x) => s + (x.soldQuantity || 0), 0).toFixed(1)} <span className="text-sm font-medium">kg</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Dispatched to buyers</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Stock Variety</p>
                    <p className="text-2xl font-extrabold text-blue-700 mt-1">{inventory.length}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Crop grade lines</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100">
                    <h4 className="font-bold text-slate-900 text-sm">Godown Stock Breakdown by Grade</h4>
                    <p className="text-xs text-slate-400">Available produce ready for marketplace listing and fulfillment</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                        <tr>
                          <th className="text-left p-3.5 font-semibold">Produce Type</th>
                          <th className="text-left p-3.5 font-semibold">Grade</th>
                          <th className="text-left p-3.5 font-semibold">Total Stock (kg)</th>
                          <th className="text-left p-3.5 font-semibold">Reserved (kg)</th>
                          <th className="text-left p-3.5 font-semibold">Sold (kg)</th>
                          <th className="text-left p-3.5 font-semibold">Available Free Stock</th>
                          <th className="text-left p-3.5 font-semibold">Stock Health</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inventory.map((i) => {
                          const free = (i.totalQuantity || 0) - (i.reservedQuantity || 0) - (i.soldQuantity || 0);
                          const isLow = free < 100;
                          return (
                            <tr key={i._id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-3.5 font-bold text-slate-900">{i.produceType}</td>
                              <td className="p-3.5">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    i.grade === 'A'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : i.grade === 'B'
                                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  Grade {i.grade}
                                </span>
                              </td>
                              <td className="p-3.5 font-semibold">{i.totalQuantity} kg</td>
                              <td className="p-3.5 text-amber-700 font-medium">{i.reservedQuantity} kg</td>
                              <td className="p-3.5 text-slate-600">{i.soldQuantity} kg</td>
                              <td className="p-3.5 font-bold text-slate-900">{Math.max(0, free).toFixed(1)} kg</td>
                              <td className="p-3.5">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                    isLow
                                      ? 'bg-red-50 text-red-700 border border-red-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  {isLow ? '⚠️ Low stock' : '✓ Sufficient'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {!inventory.length && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              No inventory yet. Grade an intake batch in the "Intake & Grading" tab first.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* LISTINGS */}
            {activeTab === 'listings' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
                    <span>🏷️</span> Create Marketplace Produce Listing
                  </h3>
                  <p className="text-xs text-slate-500 mb-5">
                    Publish graded produce to the consumer and B2B marketplace to start accepting orders.
                  </p>

                  <form onSubmit={submitListing} className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Produce Type *</label>
                      <input
                        required
                        placeholder="e.g. Tomatoes, Wheat"
                        className={inputClass}
                        value={listingForm.produceType}
                        onChange={(e) => setListingForm({ ...listingForm, produceType: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Grade *</label>
                      <select
                        className={inputClass}
                        value={listingForm.grade}
                        onChange={(e) => setListingForm({ ...listingForm, grade: e.target.value })}
                      >
                        {['A', 'B', 'C'].map((g) => (
                          <option key={g} value={g}>Grade {g}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>Price (₹/kg) *</label>
                      <input
                        required
                        type="number"
                        min="0.1"
                        step="0.01"
                        placeholder="e.g. 35.00"
                        className={inputClass}
                        value={listingForm.pricePerKg}
                        onChange={(e) => setListingForm({ ...listingForm, pricePerKg: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Available Quantity (kg) *</label>
                      <input
                        required
                        type="number"
                        min="0.1"
                        step="0.1"
                        placeholder="e.g. 250"
                        className={inputClass}
                        value={listingForm.availableQuantityKg}
                        onChange={(e) => setListingForm({ ...listingForm, availableQuantityKg: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Minimum Order (kg)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 5"
                        className={inputClass}
                        value={listingForm.minOrderQtyKg}
                        onChange={(e) => setListingForm({ ...listingForm, minOrderQtyKg: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Source Batch (Optional)</label>
                      <select
                        className={inputClass}
                        value={listingForm.sourceBatch}
                        onChange={(e) => setListingForm({ ...listingForm, sourceBatch: e.target.value })}
                      >
                        <option value="">Link to source batch (for QR)</option>
                        {batches.map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.batchId} — {b.produceType}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className={labelClass}>Produce Description</label>
                      <input
                        placeholder="e.g. Farm-fresh, naturally ripened, sorted for high quality."
                        className={inputClass}
                        value={listingForm.description}
                        onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Product Photos (Up to 5)</label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="text-xs text-slate-600 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 hover:file:bg-slate-200 cursor-pointer"
                        onChange={(e) => setListingImages(Array.from(e.target.files || []).slice(0, 5))}
                      />
                    </div>

                    <div className="md:col-span-3 pt-2">
                      <button
                        type="submit"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                      >
                        <span>+</span> Create & Publish Listing
                      </button>
                    </div>
                  </form>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100">
                    <h4 className="font-bold text-slate-900 text-sm">Active Marketplace Listings ({listings.length})</h4>
                    <p className="text-xs text-slate-400">Live catalogue items visible to consumers and institutional buyers</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                        <tr>
                          <th className="text-left p-3.5 font-semibold">Produce Type</th>
                          <th className="text-left p-3.5 font-semibold">Grade</th>
                          <th className="text-left p-3.5 font-semibold">Price per kg</th>
                          <th className="text-left p-3.5 font-semibold">Available Qty</th>
                          <th className="text-left p-3.5 font-semibold">Listing Status</th>
                          <th className="text-right p-3.5 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {listings.map((l) => (
                          <tr key={l._id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5 font-bold text-slate-900">{l.produceType}</td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800">
                                Grade {l.grade}
                              </span>
                            </td>
                            <td className="p-3.5 font-extrabold text-emerald-800">
                              ₹{Number(l.pricePerKg).toFixed(2)}/kg
                            </td>
                            <td className="p-3.5 font-semibold">{l.availableQuantityKg} kg</td>
                            <td className="p-3.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  l.status === 'Published'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {l.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-right space-x-2">
                              {l.status !== 'Published' && (
                                <button
                                  type="button"
                                  onClick={() => setListingStatus(l._id, 'Published')}
                                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold transition-all"
                                >
                                  Publish Listing
                                </button>
                              )}
                              {l.status === 'Published' && (
                                <button
                                  type="button"
                                  onClick={() => setListingStatus(l._id, 'Paused')}
                                  className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg font-semibold transition-all"
                                >
                                  Pause
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {!listings.length && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">
                              No listings created yet. Publish from your graded inventory above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ORDERS */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-slate-200/90 rounded-2xl shadow-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {['ALL', 'Placed', 'Accepted', 'Packed', 'Dispatched', 'Delivered', 'Cancelled'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setOrderStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          orderStatusFilter === status
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {status} (
                        {status === 'ALL'
                          ? fpoOrders.length
                          : fpoOrders.filter((o) => o.status === status).length}
                        )
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                        <tr>
                          <th className="text-left p-3.5 font-semibold">Produce & Grade</th>
                          <th className="text-left p-3.5 font-semibold">Buyer Name</th>
                          <th className="text-left p-3.5 font-semibold">Channel</th>
                          <th className="text-left p-3.5 font-semibold">Quantity</th>
                          <th className="text-left p-3.5 font-semibold">Total Revenue</th>
                          <th className="text-left p-3.5 font-semibold">Fulfillment Status</th>
                          <th className="text-right p-3.5 font-semibold">Advance Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOrders.map((o) => (
                          <tr key={o._id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5">
                              <span className="font-bold text-slate-900">
                                {o.listing?.produceType || 'Produce'}
                              </span>{' '}
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                Grade {o.gradeOrdered || o.listing?.grade || 'A'}
                              </span>
                            </td>
                            <td className="p-3.5 font-medium text-slate-800">{o.consumer?.name || 'Institutional Buyer'}</td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                                {o.buyerType || 'RETAIL'}
                              </span>
                            </td>
                            <td className="p-3.5 font-semibold">{o.quantityKg} kg</td>
                            <td className="p-3.5 font-extrabold text-slate-900">₹{Number(o.totalPrice || 0).toFixed(2)}</td>
                            <td className="p-3.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  o.status === 'Delivered'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : o.status === 'Placed'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {o.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {nextStatuses(o.status).map((s) => {
                                  const last = orderCooldown[o._id] || 0;
                                  const cooling = Date.now() - last < 30000;
                                  return (
                                    <button
                                      key={s}
                                      type="button"
                                      disabled={cooling}
                                      onClick={() => updateOrderStatus(o._id, s)}
                                      className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-all ${
                                        cooling
                                          ? 'opacity-40 cursor-not-allowed bg-slate-100'
                                          : 'bg-emerald-50 hover:bg-emerald-600 hover:text-white border-emerald-300 text-emerald-800 shadow-2xs'
                                      }`}
                                      title={cooling ? 'Wait 30s before status change' : `Update to ${s}`}
                                    >
                                      Mark {s} →
                                    </button>
                                  );
                                })}
                                {nextStatuses(o.status).length === 0 && (
                                  <span className="text-xs text-slate-400 font-medium">✓ Completed</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!filteredOrders.length && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400">
                              No orders found in this status category.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* EARNINGS */}
            {activeTab === 'earnings' && (
              <FpoPaymentReport data={paymentData} loading={paymentLoading} error={paymentError} />
            )}

            {/* PAYOUTS */}
            {activeTab === 'payouts' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <span>💰</span> Record & Disburse Farmer Settlement
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Direct settlement to registered farmer accounts for graded produce intake batches.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={submitPayout} className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Select Farmer *</label>
                      <select
                        required
                        className={inputClass}
                        value={payoutForm.farmerId}
                        onChange={(e) => onPayoutFarmerChange(e.target.value)}
                      >
                        <option value="">Select registered farmer</option>
                        {farmers.map((f) => (
                          <option key={f._id} value={f._id}>
                            {f.name} — {f.phone}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>Select Approved Batch *</label>
                      <select
                        required
                        className={inputClass}
                        value={payoutForm.batchId}
                        onChange={(e) => onPayoutBatchChange(e.target.value)}
                        disabled={!payoutForm.farmerId}
                      >
                        <option value="">Select batch to settle</option>
                        {batches
                          .filter((b) => {
                            const fid = b.farmer?._id || b.farmer;
                            return String(fid) === String(payoutForm.farmerId);
                          })
                          .filter((b) => b.grading?.status === 'Approved' && b.payoutStatus !== 'PAID')
                          .map((b) => (
                            <option key={b._id} value={b._id}>
                              {b.batchId} — {b.produceType} — ₹{b.amountOwedToFarmer || 0}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>Settlement Amount (₹)</label>
                      <input
                        readOnly
                        type="text"
                        placeholder="Auto-calculated from batch"
                        className={`${inputClass} bg-slate-50 font-bold text-emerald-800`}
                        value={payoutForm.amount !== '' && payoutForm.amount != null ? `₹${Number(payoutForm.amount).toFixed(2)}` : ''}
                      />
                    </div>

                    <div className="md:col-span-3 pt-2 flex items-center justify-between">
                      <button
                        type="submit"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                      >
                        <span>✓</span> Disburse Payout
                      </button>

                      <button
                        type="button"
                        onClick={downloadPayoutCsv}
                        className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl font-semibold shadow-2xs transition-all flex items-center gap-1.5"
                      >
                        <span>📥</span> Download Payout Register (CSV)
                      </button>
                    </div>
                  </form>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100">
                    <h4 className="font-bold text-slate-900 text-sm">Farmer Settlement Ledger ({payouts.length})</h4>
                    <p className="text-xs text-slate-400">Verifiable transaction logs and disbursement receipts</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                        <tr>
                          <th className="text-left p-3.5 font-semibold">Farmer</th>
                          <th className="text-left p-3.5 font-semibold">Disbursed Amount</th>
                          <th className="text-left p-3.5 font-semibold">Payment Source</th>
                          <th className="text-left p-3.5 font-semibold">Transaction ID / UTR</th>
                          <th className="text-left p-3.5 font-semibold">Settlement Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payouts.map((p) => (
                          <tr key={p._id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5 font-semibold text-slate-900">{p.farmer?.name || '—'}</td>
                            <td className="p-3.5 font-extrabold text-emerald-800">
                              ₹{Number(p.amount || p.totalAmount || 0).toFixed(2)}
                            </td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">
                                {p.paymentMethod || p.fundedFrom || 'BANK_DBT'}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-xs text-slate-500">{p.transactionId || '—'}</td>
                            <td className="p-3.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  p.status === 'Completed'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {!payouts.length && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400">
                              No payouts recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* REPORTS */}
            {activeTab === 'reports' && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2.5 bg-emerald-50 rounded-xl">📑</span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">FPO Compliance & Ledger Reports</h3>
                    <p className="text-xs text-slate-500">
                      Standardized reporting for bank audits, NABARD/SFAC reviews, and internal accounting.
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 pt-3">
                  <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Consolidated Payout Register (CSV)</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Download complete ledger containing farmer names, member IDs, bank transaction numbers, and disbursement dates.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadPayoutCsv}
                      className="mt-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all"
                    >
                      Download CSV Register →
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Individual Farmer Statements</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Generate official print-ready statements directly from the <b>Farmers</b> tab by clicking "Statement" on any member row.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('farmers')}
                      className="mt-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all"
                    >
                      Go to Farmers Directory →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT LOG */}
            {activeTab === 'audit' && (
              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100">
                  <h4 className="font-bold text-slate-900 text-sm">FPO Security & Activity Audit Trail ({activityLogs.length})</h4>
                  <p className="text-xs text-slate-400">Cryptographically logged system actions, logins, and status transitions</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                      <tr>
                        <th className="text-left p-3.5 font-semibold">Timestamp</th>
                        <th className="text-left p-3.5 font-semibold">User / Staff</th>
                        <th className="text-left p-3.5 font-semibold">Action Type</th>
                        <th className="text-left p-3.5 font-semibold">Activity Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activityLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 text-xs font-medium text-slate-500">
                            {new Date(log.createdAt).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3.5">
                            <span className="font-semibold text-slate-900">{log.actorName}</span>{' '}
                            <span className="text-[10px] uppercase font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100">
                              {log.actorRole}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-xs font-semibold text-emerald-800">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-700">{log.summary}</td>
                        </tr>
                      ))}
                      {!activityLogs.length && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400">
                            No audit log entries recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PROFILE & KYC */}
            {activeTab === 'settings' && fpoProfile && (
              <div className="grid lg:grid-cols-2 gap-6">
                {user?.role === 'fpo_admin' && (
                  <div className="lg:col-span-2">
                    <FpoLocationCard profile={fpoProfile} onSaved={loadProfile} />
                  </div>
                )}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-900 text-base">FPO Organisation Profile</h3>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${kycBadge(fpoProfile.kycStatus)}`}>
                      KYC {fpoProfile.kycStatus}
                    </span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Legal Name</span>
                      <span className="font-bold text-slate-900">{fpoProfile.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Registration Number</span>
                      <span className="font-mono font-semibold text-slate-800">{fpoProfile.registrationNumber}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Registration Type</span>
                      <span className="font-semibold text-slate-800">{fpoProfile.registrationType || 'Cooperative / Producer Co.'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Affiliated CBBO</span>
                      <span className="font-semibold text-slate-800">{fpoProfile.cbboName || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">PAN / GSTIN</span>
                      <span className="font-mono font-semibold text-slate-800">{fpoProfile.pan || '—'} / {fpoProfile.gstin || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Working Capital Credit Limit</span>
                      <span className="font-bold text-emerald-800">₹{Number(fpoProfile.creditLineAvailable || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 text-base">Upload KYC Statutory Documents</h3>
                  <p className="text-xs text-slate-500">
                    Upload FPO Registration Certificate, PAN, GST, and Board Resolution (PDF, JPG, PNG up to 5 MB).
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 hover:file:bg-slate-200 cursor-pointer"
                    onChange={(e) => setKycFiles(Array.from(e.target.files || []))}
                  />
                  <button
                    type="button"
                    onClick={uploadKyc}
                    disabled={!kycFiles.length}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow transition-all disabled:opacity-40"
                  >
                    Upload Documents
                  </button>

                  {fpoProfile.kycStatus === 'Rejected' && fpoProfile.kycRejectionReason && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium">
                      ⚠️ Rejection Reason: {fpoProfile.kycRejectionReason}
                    </div>
                  )}

                  {(fpoProfile.kycDocuments || []).length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs font-bold text-slate-700 mb-2">Uploaded Documents on File:</p>
                      <ul className="text-xs space-y-1.5">
                        {fpoProfile.kycDocuments.map((_, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span>📄</span>
                            <button type="button" onClick={() => viewKycDocument(i)} className="text-emerald-700 underline font-semibold">
                              View Statutory Document #{i + 1}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {user?.role === 'fpo_admin' && (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4 lg:col-span-2">
                    <h3 className="font-bold text-slate-900 text-base">Add Staff Operator User</h3>
                    <p className="text-xs text-slate-500">Create access credentials for collection center and weighing scale operators.</p>
                    <form onSubmit={addStaff} className="grid md:grid-cols-4 gap-3">
                      <input
                        required
                        placeholder="Staff Name"
                        className={inputClass}
                        value={staffForm.name}
                        onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                      />
                      <input
                        required
                        type="email"
                        placeholder="Operator Email"
                        className={inputClass}
                        value={staffForm.email}
                        onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                      />
                      <input
                        required
                        type="password"
                        placeholder="Operator Password"
                        className={inputClass}
                        value={staffForm.password}
                        onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                      />
                      <input
                        placeholder="Center / Location"
                        className={inputClass}
                        value={staffForm.location}
                        onChange={(e) => setStaffForm({ ...staffForm, location: e.target.value })}
                      />
                      <div className="md:col-span-4 pt-1">
                        <button
                          type="submit"
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow transition-all"
                        >
                          + Create Staff Account
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* COMPLIANCE */}
            {activeTab === 'completion' && (
              <div className="space-y-10">
                <ComplianceTracker />
                <FpoCompletionPanel
                  profile={fpoProfile}
                  farmers={farmers}
                  batches={batches}
                  onRefresh={() => {
                    loadProfile();
                    loadAll();
                  }}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </AutoTranslate>
  );
}