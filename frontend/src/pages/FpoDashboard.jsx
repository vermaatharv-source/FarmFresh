import BrandLogo from '../components/BrandLogo';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import FpoCompletionPanel from '../components/FpoCompletionPanel';

const NAV = [
  { id: 'analytics', label: 'Overview' },
  { id: 'farmers', label: 'Farmers' },
  { id: 'intake', label: 'Intake & Grading' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'listings', label: 'Listings' },
  { id: 'orders', label: 'Orders' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'reports', label: 'Reports' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'settings', label: 'Profile & KYC' },
  { id: 'completion', label: 'Compliance' },
];

const kycBadge = (status) => {
  if (status === 'Verified')
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'Rejected') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
};

export default function FpoDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('analytics');
  const [fpoProfile, setFpoProfile] = useState(undefined);
  const [analytics, setAnalytics] = useState({});
  const [farmers, setFarmers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [listings, setListings] = useState([]);
  const [fpoOrders, setFpoOrders] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

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
    transactionId: '',
  });
  const [orderCooldown, setOrderCooldown] = useState({}); // orderId -> timestamp ms
  const [listingImages, setListingImages] = useState([]);
  const [lastIntakeQr, setLastIntakeQr] = useState(null);
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
    }, 3000);
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
      });
      flash('Farmer registered');
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
      });
      const batch = res.data?.batch || res.data;
      setLastIntakeQr(batch?.qrCodeUrl || null);
      flash(batch?.batchId ? `Intake recorded — ${batch.batchId}` : 'Intake recorded');
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
      flash('Grading saved');
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
        transactionId: payoutForm.transactionId || undefined,
      });
      flash('Payout recorded');
      setPayoutForm({ farmerId: '', batchId: '', amount: '', transactionId: '' });
      loadAll();
    } catch (e) {
      flash(e.response?.data?.message || 'Payout failed (KYC may be required)', true);
    }
  };

  const onPayoutFarmerChange = (farmerId) => {
    setPayoutForm({ farmerId, batchId: '', amount: '', transactionId: payoutForm.transactionId });
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
      flash(`Order marked ${status}`);
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
      flash('Listing created');
      setListingForm({
        produceType: '',
        grade: 'A',
        pricePerKg: '',
        availableQuantityKg: '',
        minOrderQtyKg: '1',
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
      flash(`Listing ${status.toLowerCase()}`);
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
      flash('KYC documents uploaded');
      setKycFiles([]);
      loadProfile();
    } catch (e) {
      flash(e.response?.data?.message || 'KYC upload failed', true);
    }
  };

  // KYC documents are private: fetched with the login token and shown from a temporary local URL.
  const viewKycDocument = async (index) => {
    const win = window.open('', '_blank');
    try {
      const res = await API.get(`/fpo/kyc/documents/${index}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      if (win) win.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (win) win.close();
      flash('Could not open the document', true);
    }
  };

  const addStaff = async (e) => {
    e.preventDefault();
    try {
      await API.post('/fpo/staff', staffForm);
      flash('Staff member added');
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
    w.document.write(`<!DOCTYPE html><html><head><title>Payment Statement</title>
      <style>
        body{font-family:Georgia,serif;padding:40px;color:#111}
        h1{font-size:18px;margin:0}
        .meta{font-size:12px;color:#444;margin:8px 0 24px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ccc;padding:8px;text-align:left}
        th{background:#f5f5f5}
        .foot{margin-top:32px;font-size:11px;color:#666}
        .hdr{display:flex;justify-content:space-between;border-bottom:2px solid #065f46;padding-bottom:12px;margin-bottom:16px}
      </style></head><body>
      <div class="hdr">
        <div>
          <h1>${fpoProfile?.name || 'FPO'}</h1>
          <div class="meta">Reg. No: ${fpoProfile?.registrationNumber || '—'} · KYC: ${fpoProfile?.kycStatus || '—'}</div>
        </div>
        <div style="text-align:right;font-size:12px">Farmer Payment Statement<br/>Generated ${new Date().toLocaleDateString()}</div>
      </div>
      <p><strong>Farmer:</strong> ${farmer.name} &nbsp; <strong>Phone:</strong> ${farmer.phone}<br/>
      <strong>Member ID:</strong> ${farmer.memberId || '—'} &nbsp; <strong>Village:</strong> ${farmer.village || '—'}</p>
      <table><thead><tr><th>Date</th><th>Batch</th><th>Amount (₹)</th><th>Method</th><th>Txn ID</th><th>Status</th></tr></thead>
      <tbody>
      ${related.length ? related.map((p) => `<tr>
        <td>${p.paidAt || p.paymentDate ? new Date(p.paidAt || p.paymentDate).toLocaleDateString() : '—'}</td>
        <td>${p.batch?.batchId || '—'}</td>
        <td>${p.amount || p.totalAmount || 0}</td>
        <td>${p.paymentMethod || '—'}</td>
        <td>${p.transactionId || '—'}</td>
        <td>${p.status}</td>
      </tr>`).join('') : '<tr><td colspan="6">No payouts recorded</td></tr>'}
      </tbody></table>
      <p class="foot">This statement is system-generated for compliance and farmer records. Bank account numbers are not printed in full.</p>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  if (fpoProfile === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-600">
        Loading FPO portal…
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-slate-100">
      {/* Sidebar — fixed height, logout always visible at bottom */}
      <aside className="w-64 h-full bg-slate-900 text-slate-100 flex flex-col shrink-0 overflow-hidden">
        <div className="px-5 py-5 border-b border-slate-700">
          <BrandLogo size="sm" className="mb-3" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">FPO Portal</p>
          <h1 className="text-sm font-semibold mt-1 leading-snug line-clamp-2">
            {fpoProfile?.name || 'Register your FPO'}
          </h1>
          {fpoProfile?.registrationNumber && (
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              {fpoProfile.registrationNumber}
            </p>
          )}
          {fpoProfile && (
            <span
              className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded border ${kycBadge(
                fpoProfile.kycStatus
              )}`}
            >
              KYC {fpoProfile.kycStatus}
            </span>
          )}
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-5 py-2.5 text-sm transition ${
                activeTab === item.id
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-700 p-4 space-y-2">
          <p className="text-xs text-slate-400 truncate">{user?.name}</p>
          <p className="text-[10px] text-slate-500 uppercase">{user?.role?.replace('_', ' ')}</p>
          <button
            onClick={handleLogout}
            className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-sm py-2 rounded border border-slate-600"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 capitalize">
              {NAV.find((n) => n.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-slate-500">
              Manage intake, grading, payouts and compliance records
            </p>
          </div>
          {fpoProfile?.kycStatus !== 'Verified' && (
            <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded">
              KYC not verified — publishing listings and payouts may be restricted
            </div>
          )}
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {msg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded text-sm">
              {msg}
            </div>
          )}
          {err && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
              {err}
            </div>
          )}

          {/* OVERVIEW */}
          {activeTab === 'analytics' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Member farmers', value: analytics.totalFarmers ?? farmers.length },
                { label: 'Intake batches', value: analytics.totalBatches ?? batches.length },
                { label: 'Stock (kg)', value: analytics.totalStockKg ?? '—' },
                {
                  label: 'Payouts distributed (₹)',
                  value: analytics.totalPayoutsDistributed ?? '—',
                },
              ].map((c) => (
                <div key={c.label} className="bg-white border rounded-lg p-5">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-2">{c.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* FARMERS */}
          {activeTab === 'farmers' && (
            <div className="space-y-6">
              <form onSubmit={submitFarmer} className="bg-white border rounded-lg p-5 grid md:grid-cols-3 gap-3">
                <h3 className="md:col-span-3 font-semibold text-slate-800 text-sm">Register farmer</h3>
                {[
                  ['name', 'Full name *'],
                  ['phone', 'Phone *'],
                  ['aadhaarNumber', 'Aadhaar (masked on save)'],
                  ['memberId', 'Member / Shareholder ID'],
                  ['village', 'Village'],
                  ['block', 'Block'],
                  ['district', 'District'],
                  ['state', 'State'],
                  ['landHoldingAcres', 'Land holding (acres)'],
                  ['cropsGrown', 'Crops (comma-separated)'],
                  ['joiningDate', 'Joining date'],
                  ['address', 'Address'],
                ].map(([k, label]) => (
                  <label key={k} className="text-xs text-slate-600">
                    {label}
                    <input
                      type={k === 'joiningDate' ? 'date' : k === 'landHoldingAcres' ? 'number' : 'text'}
                      className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                      value={farmerForm[k]}
                      onChange={(e) => setFarmerForm({ ...farmerForm, [k]: e.target.value })}
                      required={k === 'name' || k === 'phone'}
                    />
                  </label>
                ))}
                <label className="text-xs text-slate-600">
                  Gender
                  <select
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                    value={farmerForm.gender}
                    onChange={(e) => setFarmerForm({ ...farmerForm, gender: e.target.value })}
                  >
                    <option value="">—</option>
                    {['Male', 'Female', 'Other'].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Category
                  <select
                    className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                    value={farmerForm.category}
                    onChange={(e) => setFarmerForm({ ...farmerForm, category: e.target.value })}
                  >
                    <option value="">—</option>
                    {['General', 'OBC', 'SC', 'ST', 'Other'].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                {user?.role === 'fpo_admin' && (
                  <>
                    <label className="text-xs text-slate-600">
                      Bank account
                      <input
                        className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                        value={farmerForm.accountNumber}
                        onChange={(e) =>
                          setFarmerForm({ ...farmerForm, accountNumber: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      IFSC
                      <input
                        className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                        value={farmerForm.ifscCode}
                        onChange={(e) => setFarmerForm({ ...farmerForm, ifscCode: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Bank name
                      <input
                        className="mt-1 w-full border rounded px-2 py-1.5 text-sm"
                        value={farmerForm.bankName}
                        onChange={(e) => setFarmerForm({ ...farmerForm, bankName: e.target.value })}
                      />
                    </label>
                  </>
                )}
                <div className="md:col-span-3">
                  <button type="submit" className="bg-emerald-700 text-white text-sm px-4 py-2 rounded">
                    Save farmer
                  </button>
                </div>
              </form>

              <div className="bg-white border rounded-lg p-5 flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Bulk import (Excel / CSV)</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Columns: name, phone, village, block, district, state, landHoldingAcres, crops,
                    gender, category, memberId, joiningDate, accountNumber, ifscCode, bankName,
                    aadhaarNumber
                  </p>
                </div>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setCsvFile(e.target.files?.[0])} />
                <button
                  type="button"
                  onClick={importFarmers}
                  disabled={!csvFile}
                  className="bg-slate-800 text-white text-sm px-4 py-2 rounded disabled:opacity-40"
                >
                  Import
                </button>
              </div>

              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b">
                    <tr>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-left px-4 py-2">Phone</th>
                      <th className="text-left px-4 py-2">Village / District</th>
                      <th className="text-left px-4 py-2">Member ID</th>
                      <th className="text-left px-4 py-2">Land (ac)</th>
                      <th className="text-left px-4 py-2">Aadhaar</th>
                      <th className="text-left px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmers.map((f) => (
                      <tr key={f._id} className="border-b last:border-0">
                        <td className="px-4 py-2 font-medium">{f.name}</td>
                        <td className="px-4 py-2">{f.phone}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {[f.village, f.district].filter(Boolean).join(', ') || f.address || '—'}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{f.memberId || '—'}</td>
                        <td className="px-4 py-2">{f.landHoldingAcres || '—'}</td>
                        <td className="px-4 py-2 text-xs">{f.aadhaarNumber || '—'}</td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => printFarmerStatement(f)}
                            className="text-xs text-emerald-700 hover:underline"
                          >
                            Statement
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!farmers.length && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                          No farmers registered yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INTAKE */}
          {activeTab === 'intake' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <form onSubmit={submitIntake} className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-sm text-slate-800">Record produce intake</h3>
                <select
                  required
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={intakeForm.farmerId}
                  onChange={(e) => setIntakeForm({ ...intakeForm, farmerId: e.target.value })}
                >
                  <option value="">Select farmer</option>
                  {farmers.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} — {f.phone}
                    </option>
                  ))}
                </select>
                <input
                  required
                  placeholder="Produce type"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={intakeForm.produceType}
                  onChange={(e) => setIntakeForm({ ...intakeForm, produceType: e.target.value })}
                />
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Quantity (kg)"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={intakeForm.rawQuantityKg}
                  onChange={(e) => setIntakeForm({ ...intakeForm, rawQuantityKg: e.target.value })}
                />
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={intakeForm.harvestDate}
                  onChange={(e) => setIntakeForm({ ...intakeForm, harvestDate: e.target.value })}
                />
                <button type="submit" className="bg-emerald-700 text-white text-sm px-4 py-2 rounded">
                  Save intake
                </button>
                {lastIntakeQr && (
                  <div className="mt-3 p-3 bg-slate-50 border rounded-lg">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Batch QR code generated</p>
                    <img src={lastIntakeQr} alt="Batch QR" className="w-36 h-36 bg-white border rounded" />
                    <p className="text-[11px] text-slate-500 mt-1">Scan or open /trace/&lt;BatchID&gt;</p>
                  </div>
                )}
              </form>

              <form onSubmit={submitGrading} className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-sm text-slate-800">Grade batch</h3>
                <select
                  required
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={gradingForm.batchId}
                  onChange={(e) => setGradingForm({ ...gradingForm, batchId: e.target.value })}
                >
                  <option value="">Select batch</option>
                  {batches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.batchId} — {b.produceType} ({b.rawQuantityKg}kg)
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-3 gap-2">
                  {['gradeA_Kg', 'gradeB_Kg', 'gradeC_Kg'].map((k, i) => (
                    <input
                      key={k}
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder={`Grade ${['A', 'B', 'C'][i]} kg`}
                      className="border rounded px-2 py-2 text-sm"
                      value={gradingForm[k]}
                      onChange={(e) => setGradingForm({ ...gradingForm, [k]: e.target.value })}
                    />
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Quality score"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={gradingForm.qualityScore}
                  onChange={(e) => setGradingForm({ ...gradingForm, qualityScore: e.target.value })}
                />
                <button type="submit" className="bg-slate-800 text-white text-sm px-4 py-2 rounded">
                  Submit grading
                </button>
              </form>

              <div className="lg:col-span-2 bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-2">Batch</th>
                      <th className="text-left px-4 py-2">Produce</th>
                      <th className="text-left px-4 py-2">Qty</th>
                      <th className="text-left px-4 py-2">Payout</th>
                      <th className="text-left px-4 py-2">Status</th>
                      <th className="text-left px-4 py-2">QR Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b._id} className="border-b">
                        <td className="px-4 py-2 font-mono text-xs">{b.batchId}</td>
                        <td className="px-4 py-2">{b.produceType}</td>
                        <td className="px-4 py-2">{b.rawQuantityKg} kg</td>
                        <td className="px-4 py-2">₹{b.amountOwedToFarmer || 0}</td>
                        <td className="px-4 py-2">{b.payoutStatus}</td>
                        <td className="px-4 py-2">
                          {b.qrCodeUrl ? (
                            <img src={b.qrCodeUrl} alt="QR" className="w-12 h-12 border rounded bg-white" title={b.batchId} />
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INVENTORY */}
          {activeTab === 'inventory' && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-2">Produce</th>
                    <th className="text-left px-4 py-2">Grade</th>
                    <th className="text-left px-4 py-2">Total</th>
                    <th className="text-left px-4 py-2">Reserved</th>
                    <th className="text-left px-4 py-2">Sold</th>
                    <th className="text-left px-4 py-2">Stock status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((i) => (
                    <tr key={i._id} className="border-b">
                      <td className="px-4 py-2">{i.produceType}</td>
                      <td className="px-4 py-2">{i.grade}</td>
                      <td className="px-4 py-2">{i.totalQuantity} kg</td>
                      <td className="px-4 py-2">{i.reservedQuantity} kg</td>
                      <td className="px-4 py-2">{i.soldQuantity} kg</td>
                        <td className="px-4 py-2">
                          {(() => {
                            const free = (i.totalQuantity || 0) - (i.reservedQuantity || 0) - (i.soldQuantity || 0);
                            const low = free < 100;
                            return (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${low ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {low ? 'Low stock' : 'Sufficient'} ({free} kg)
                              </span>
                            );
                          })()}
                        </td>
                    </tr>
                  ))}
                  {!inventory.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        No inventory yet — grade an intake batch first
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* LISTINGS */}
          {activeTab === 'listings' && (
            <div className="space-y-6">
              <form onSubmit={submitListing} className="bg-white border rounded-lg p-5 grid md:grid-cols-3 gap-3">
                <h3 className="md:col-span-3 font-semibold text-sm">Create listing from inventory</h3>
                <input
                  required
                  placeholder="Produce type"
                  className="border rounded px-3 py-2 text-sm"
                  value={listingForm.produceType}
                  onChange={(e) => setListingForm({ ...listingForm, produceType: e.target.value })}
                />
                <select
                  className="border rounded px-3 py-2 text-sm"
                  value={listingForm.grade}
                  onChange={(e) => setListingForm({ ...listingForm, grade: e.target.value })}
                >
                  {['A', 'B', 'C'].map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price ₹/kg"
                  className="border rounded px-3 py-2 text-sm"
                  value={listingForm.pricePerKg}
                  onChange={(e) => setListingForm({ ...listingForm, pricePerKg: e.target.value })}
                />
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  placeholder="Quantity kg"
                  className="border rounded px-3 py-2 text-sm"
                  value={listingForm.availableQuantityKg}
                  onChange={(e) =>
                    setListingForm({ ...listingForm, availableQuantityKg: e.target.value })
                  }
                />
                <input
                  type="number"
                  min="0.001"
                  placeholder="Min order kg"
                  className="border rounded px-3 py-2 text-sm"
                  value={listingForm.minOrderQtyKg}
                  onChange={(e) => setListingForm({ ...listingForm, minOrderQtyKg: e.target.value })}
                />
                <input
                  placeholder="Description"
                  className="border rounded px-3 py-2 text-sm md:col-span-2"
                  value={listingForm.description}
                  onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                />
                                <div className="md:col-span-3">
                  <label className="block text-xs text-slate-600 mb-1">Product images (optional, up to 5)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="w-full border rounded px-3 py-2 text-sm"
                    onChange={(e) => setListingImages(Array.from(e.target.files || []).slice(0, 5))}
                  />
                  {listingImages?.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">{listingImages.length} file(s) selected</p>
                  )}
                </div>
<button type="submit" className="bg-emerald-700 text-white text-sm px-4 py-2 rounded">
                  Create draft
                </button>
              </form>

              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-2">Produce</th>
                      <th className="text-left px-4 py-2">Grade</th>
                      <th className="text-left px-4 py-2">Price</th>
                      <th className="text-left px-4 py-2">Qty</th>
                      <th className="text-left px-4 py-2">Status</th>
                      <th className="text-left px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l) => (
                      <tr key={l._id} className="border-b">
                        <td className="px-4 py-2">{l.produceType}</td>
                        <td className="px-4 py-2">{l.grade}</td>
                        <td className="px-4 py-2">₹{l.pricePerKg}/kg</td>
                        <td className="px-4 py-2">{l.availableQuantityKg} kg</td>
                        <td className="px-4 py-2">{l.status}</td>
                        <td className="px-4 py-2 space-x-2">
                          {l.status !== 'Published' && (
                            <button
                              type="button"
                              onClick={() => setListingStatus(l._id, 'Published')}
                              className="text-xs text-emerald-700 hover:underline"
                            >
                              Publish
                            </button>
                          )}
                          {l.status === 'Published' && (
                            <button
                              type="button"
                              onClick={() => setListingStatus(l._id, 'Paused')}
                              className="text-xs text-amber-700 hover:underline"
                            >
                              Pause
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ORDERS */}
          {activeTab === 'orders' && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-2">Produce</th>
                    <th className="text-left px-4 py-2">Buyer</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Qty</th>
                    <th className="text-left px-4 py-2">Total</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Update status</th>
                  </tr>
                </thead>
                <tbody>
                  {fpoOrders.map((o) => (
                    <tr key={o._id} className="border-b">
                      <td className="px-4 py-2">
                        {o.listing?.produceType} Grade {o.gradeOrdered || o.listing?.grade}
                      </td>
                      <td className="px-4 py-2">{o.consumer?.name || '—'}</td>
                      <td className="px-4 py-2">{o.buyerType}</td>
                      <td className="px-4 py-2">{o.quantityKg} kg</td>
                      <td className="px-4 py-2">₹{o.totalPrice}</td>
                      <td className="px-4 py-2 font-medium">{o.status}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {nextStatuses(o.status).map((s) => {
                            const last = orderCooldown[o._id] || 0;
                            const cooling = Date.now() - last < 30000;
                            return (
                              <button
                                key={s}
                                type="button"
                                disabled={cooling}
                                onClick={() => updateOrderStatus(o._id, s)}
                                className={`text-[11px] px-2 py-1 rounded border ${
                                  cooling
                                    ? 'opacity-40 cursor-not-allowed bg-slate-100'
                                    : 'bg-white hover:bg-emerald-50 border-emerald-300 text-emerald-800'
                                }`}
                                title={cooling ? 'Wait 30 seconds between status changes' : `Mark ${s}`}
                              >
                                {s}
                              </button>
                            );
                          })}
                          {nextStatuses(o.status).length === 0 && (
                            <span className="text-xs text-slate-400">No further actions</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!fpoOrders.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                        No orders yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* PAYOUTS */}
          {activeTab === 'payouts' && (
            <div className="space-y-6">
              <form onSubmit={submitPayout} className="bg-white border rounded-lg p-5 grid md:grid-cols-2 gap-3">
                <h3 className="md:col-span-2 font-semibold text-sm">Record farmer payout</h3>
                <select
                  required
                  className="border rounded px-3 py-2 text-sm"
                  value={payoutForm.farmerId}
                  onChange={(e) => onPayoutFarmerChange(e.target.value)}
                >
                  <option value="">Select farmer</option>
                  {farmers.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <select
                  required
                  className="border rounded px-3 py-2 text-sm"
                  value={payoutForm.batchId}
                  onChange={(e) => onPayoutBatchChange(e.target.value)}
                  disabled={!payoutForm.farmerId}
                >
                  <option value="">Select batch for this farmer</option>
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
                <input
                  readOnly
                  type="text"
                  placeholder="Amount (auto from batch)"
                  className="border rounded px-3 py-2 text-sm bg-slate-50 text-slate-800 font-semibold"
                  value={payoutForm.amount !== '' && payoutForm.amount != null ? `₹${payoutForm.amount}` : ''}
                />
                <input
                  placeholder="Transaction ID"
                  className="border rounded px-3 py-2 text-sm"
                  value={payoutForm.transactionId}
                  onChange={(e) => setPayoutForm({ ...payoutForm, transactionId: e.target.value })}
                />
                <button type="submit" className="bg-emerald-700 text-white text-sm px-4 py-2 rounded">
                  Save payout
                </button>
              </form>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={downloadPayoutCsv}
                  className="text-sm border px-3 py-1.5 rounded hover:bg-slate-50"
                >
                  Download payout CSV
                </button>
              </div>

              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-2">Farmer</th>
                      <th className="text-left px-4 py-2">Amount</th>
                      <th className="text-left px-4 py-2">Method</th>
                      <th className="text-left px-4 py-2">Funded from</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p._id} className="border-b">
                        <td className="px-4 py-2">{p.farmer?.name || '—'}</td>
                        <td className="px-4 py-2">₹{p.amount || p.totalAmount}</td>
                        <td className="px-4 py-2">{p.paymentMethod}</td>
                        <td className="px-4 py-2">{p.fundedFrom}</td>
                        <td className="px-4 py-2">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REPORTS */}
          {activeTab === 'reports' && (
            <div className="bg-white border rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-slate-800">Compliance reports</h3>
              <p className="text-sm text-slate-600">
                Generate farmer payment statements from the Farmers tab (Statement button). Download
                the consolidated payout register as CSV below. For formal PDF filings, use the print
                dialog on each statement (Save as PDF).
              </p>
              <button
                type="button"
                onClick={downloadPayoutCsv}
                className="bg-slate-800 text-white text-sm px-4 py-2 rounded"
              >
                Download payout register (CSV)
              </button>
            </div>
          )}

          {/* AUDIT */}
          {activeTab === 'audit' && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-2">When</th>
                    <th className="text-left px-4 py-2">Actor</th>
                    <th className="text-left px-4 py-2">Action</th>
                    <th className="text-left px-4 py-2">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((log) => (
                    <tr key={log._id} className="border-b">
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        {log.actorName}{' '}
                        <span className="text-xs text-slate-400">({log.actorRole})</span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                      <td className="px-4 py-2">{log.summary}</td>
                    </tr>
                  ))}
                  {!activityLogs.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                        No audit entries yet. Actions are logged as you use the portal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && fpoProfile && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-sm">Organisation profile</h3>
                <p className="text-sm text-slate-700">
                  <span className="text-slate-500">Name:</span> {fpoProfile.name}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="text-slate-500">Registration:</span>{' '}
                  {fpoProfile.registrationNumber}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="text-slate-500">Type:</span>{' '}
                  {fpoProfile.registrationType || '—'}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="text-slate-500">PAN / GSTIN:</span> {fpoProfile.pan || '—'} /{' '}
                  {fpoProfile.gstin || '—'}
                </p>
                <p className="text-sm">
                  <span
                    className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${kycBadge(
                      fpoProfile.kycStatus
                    )}`}
                  >
                    KYC {fpoProfile.kycStatus}
                  </span>
                </p>
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-sm">Upload KYC documents</h3>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => setKycFiles(Array.from(e.target.files || []))}
                />
                <p className="text-xs text-slate-500">
                  Registration certificate, PAN, GST and similar documents. PDF, JPG or PNG, up to 5 MB each (max 5 files per upload).
                </p>
                <button
                  type="button"
                  onClick={uploadKyc}
                  disabled={!kycFiles.length}
                  className="bg-emerald-700 text-white text-sm px-4 py-2 rounded disabled:opacity-40"
                >
                  Upload
                </button>
                <p className="text-xs text-slate-500">
                  {fpoProfile.kycDocuments?.length || 0} document(s) on file. Documents are private and visible only to you and the reviewing authority.
                </p>
                {fpoProfile.kycStatus === 'Rejected' && fpoProfile.kycRejectionReason && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                    KYC rejected: {fpoProfile.kycRejectionReason}
                  </p>
                )}
                {(fpoProfile.kycDocuments || []).length > 0 && (
                  <ul className="text-sm space-y-1">
                    {fpoProfile.kycDocuments.map((_, i) => (
                      <li key={i}>
                        <button type="button" onClick={() => viewKycDocument(i)} className="text-emerald-700 underline">
                          View document {i + 1}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {user?.role === 'fpo_admin' && (
                <form onSubmit={addStaff} className="bg-white border rounded-lg p-5 space-y-3 lg:col-span-2">
                  <h3 className="font-semibold text-sm">Add staff user</h3>
                  <div className="grid md:grid-cols-4 gap-3">
                    <input
                      required
                      placeholder="Name"
                      className="border rounded px-3 py-2 text-sm"
                      value={staffForm.name}
                      onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    />
                    <input
                      required
                      type="email"
                      placeholder="Email"
                      className="border rounded px-3 py-2 text-sm"
                      value={staffForm.email}
                      onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    />
                    <input
                      required
                      type="password"
                      placeholder="Password"
                      className="border rounded px-3 py-2 text-sm"
                      value={staffForm.password}
                      onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    />
                    <input
                      placeholder="Location"
                      className="border rounded px-3 py-2 text-sm"
                      value={staffForm.location}
                      onChange={(e) => setStaffForm({ ...staffForm, location: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="bg-slate-800 text-white text-sm px-4 py-2 rounded">
                    Add staff
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'completion' && (
            <FpoCompletionPanel
              profile={fpoProfile}
              farmers={farmers}
              batches={batches}
              onRefresh={() => {
                loadProfile();
                loadAll();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}