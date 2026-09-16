import React, { useState, useEffect } from 'react';
import API from '../api/axios';
import FpoCompletionPanel from '../components/FpoCompletionPanel';

export default function FpoDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [analytics, setAnalytics] = useState({});
  const [farmers, setFarmers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [payouts, setPayouts] = useState([]);

  const [fpoProfile, setFpoProfile] = useState(undefined); // undefined = loading, null = none yet
  const [profileForm, setProfileForm] = useState({
    name: '',
    registrationNumber: '',
    phone: '',
    email: '',
    address: '',
  });

  // Forms State
  const [farmerForm, setFarmerForm] = useState({ name: '', phone: '', address: '', aadhaarNumber: '' });
  const [intakeForm, setIntakeForm] = useState({ farmerId: '', produceType: '', rawQuantityKg: '', harvestDate: '' });
  const [gradingForm, setGradingForm] = useState({
    batchId: '',
    gradeA_Kg: 0,
    gradeB_Kg: 0,
    gradeC_Kg: 0,
    qualityScore: 8.5,
    status: 'Approved',
  });
  const [gradingImages, setGradingImages] = useState([]);
  const [payoutForm, setPayoutForm] = useState({ farmerId: '', batchId: '', amount: '', transactionId: '' });

  // CSV bulk import
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState('');

  // KYC + Staff (Settings tab)
  const [kycFiles, setKycFiles] = useState([]);
  const [kycUploading, setKycUploading] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', location: '' });

  // NEW: Listings (linked to Inventory)
  const [listings, setListings] = useState([]);
  const [listingForm, setListingForm] = useState({ produceType: '', grade: 'A', pricePerKg: '', availableQuantityKg: '', minOrderQtyKg: 1, description: '', sourceBatch: '' });
  const [listingImages, setListingImages] = useState([]);

  // NEW: FPO Orders (consumer orders against listings)
  const [fpoOrders, setFpoOrders] = useState([]);
  const [cancelReason, setCancelReason] = useState({});

  // NEW: Reports
  const [salesReport, setSalesReport] = useState({ totalRevenue: 0, bestSelling: [], gradeDistribution: [] });
  const [farmerPerformance, setFarmerPerformance] = useState([]);
  const [monthlyReport, setMonthlyReport] = useState([]);
  const [settlement, setSettlement] = useState({ totalEarnings: 0, orders: [] });

  // NEW: Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // NEW: Stock movements + low stock (Inventory tab)
  const [stockMovements, setStockMovements] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);

  // NEW: Farmer detail modal
  const [farmerDetail, setFarmerDetail] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (fpoProfile) {
      fetchAnalytics();
      fetchFarmers();
      fetchBatches();
      fetchInventory();
      fetchPayouts();
      fetchListings();
      fetchFpoOrders();
      fetchNotifications();
      fetchStockMovements();
      fetchLowStockAlerts();
      fetchSalesReport();
      fetchFarmerPerformance();
      fetchMonthlyReport();
      fetchSettlement();
    }
  }, [fpoProfile]);

  const fetchProfile = async () => {
    try {
      const res = await API.get('/fpo/profile');
      setFpoProfile(res.data); // null if none exists yet
    } catch (err) {
      console.error('Error fetching FPO profile:', err);
      setFpoProfile(null);
    }
  };

  const handleRegisterFpo = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/fpo/register', {
        name: profileForm.name,
        registrationNumber: profileForm.registrationNumber,
        contactDetails: {
          phone: profileForm.phone,
          email: profileForm.email,
          address: profileForm.address,
        },
      });
      setFpoProfile(res.data.fpo);
    } catch (err) {
      alert(err.response?.data?.message || 'Error registering FPO');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await API.get('/fpo/analytics');
      setAnalytics(res.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const fetchFarmers = async () => {
    try {
      const res = await API.get('/fpo/farmers');
      setFarmers(res.data);
    } catch (err) {
      console.error('Error fetching farmers:', err);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await API.get('/fpo/batches');
      setBatches(res.data);
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await API.get('/fpo/inventory');
      setInventory(res.data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  const fetchPayouts = async () => {
    try {
      const res = await API.get('/fpo/payouts');
      setPayouts(res.data);
    } catch (err) {
      console.error('Error fetching payouts:', err);
    }
  };

  // ===== NEW: Listings =====
  const fetchListings = async () => {
    try {
      const res = await API.get('/listings/mine');
      setListings(res.data);
    } catch (err) {
      console.error('Error fetching listings:', err);
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    try {
      const form = new FormData();
      Object.entries({ ...listingForm, pricePerKg: Number(listingForm.pricePerKg), availableQuantityKg: Number(listingForm.availableQuantityKg), minOrderQtyKg: Number(listingForm.minOrderQtyKg) || 1 }).forEach(([k,v]) => { if (v !== '' && v !== undefined) form.append(k, v); });
      listingImages.forEach((file) => form.append('images', file));
      await API.post('/listings', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setListingForm({ produceType: '', grade: 'A', pricePerKg: '', availableQuantityKg: '', minOrderQtyKg: 1, description: '', sourceBatch: '' });
      setListingImages([]);
      fetchListings();
      fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating listing');
    }
  };

  const handleSetListingStatus = async (id, status) => {
    try {
      await API.patch(`/listings/${id}/status`, { status });
      fetchListings();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating listing status');
    }
  };

  const handleDeleteListing = async (id) => {
    if (!window.confirm('Delete this listing? Reserved stock will be released back to inventory.')) return;
    try {
      await API.delete(`/listings/${id}`);
      fetchListings();
      fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting listing');
    }
  };

  // ===== NEW: FPO Orders (incoming, from consumers) =====
  const fetchFpoOrders = async () => {
    try {
      const res = await API.get('/fpo-orders/fpo');
      setFpoOrders(res.data);
    } catch (err) {
      console.error('Error fetching FPO orders:', err);
    }
  };

  const handleUpdateOrderStatus = async (id, status) => {
    try {
      await API.patch(`/fpo-orders/${id}/status`, { status });
      fetchFpoOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating order status');
    }
  };

  const handleCancelOrder = async (id) => {
    try {
      await API.patch(`/fpo-orders/${id}/cancel`, { reason: cancelReason[id] || '' });
      setCancelReason({ ...cancelReason, [id]: '' });
      fetchFpoOrders();
      fetchListings();
      fetchInventory();
    } catch (err) {
      alert(err.response?.data?.message || 'Error cancelling order');
    }
  };

  // ===== NEW: Notifications =====
  const fetchNotifications = async () => {
    try {
      const res = await API.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleMarkNotificationRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await API.patch('/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  // ===== NEW: Inventory movements + low stock =====
  const fetchStockMovements = async () => {
    try {
      const res = await API.get('/fpo/inventory/movements');
      setStockMovements(res.data);
    } catch (err) {
      console.error('Error fetching stock movements:', err);
    }
  };

  const fetchLowStockAlerts = async () => {
    try {
      const res = await API.get('/fpo/inventory/low-stock');
      setLowStockAlerts(res.data);
    } catch (err) {
      console.error('Error fetching low stock alerts:', err);
    }
  };

  // ===== NEW: Reports =====
  const fetchSalesReport = async () => {
    try {
      const res = await API.get('/reports/sales');
      setSalesReport(res.data);
    } catch (err) {
      console.error('Error fetching sales report:', err);
    }
  };

  const fetchFarmerPerformance = async () => {
    try {
      const res = await API.get('/reports/farmer-performance');
      setFarmerPerformance(res.data);
    } catch (err) {
      console.error('Error fetching farmer performance:', err);
    }
  };

  const fetchMonthlyReport = async () => {
    try {
      const res = await API.get('/reports/monthly');
      setMonthlyReport(res.data);
    } catch (err) {
      console.error('Error fetching monthly report:', err);
    }
  };

  const fetchSettlement = async () => {
    try {
      const res = await API.get('/reports/settlement');
      setSettlement(res.data);
    } catch (err) {
      console.error('Error fetching settlement:', err);
    }
  };

  const handleDownloadPayoutReport = async () => {
    try {
      const res = await API.get('/reports/payouts/download', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'payout_report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Error downloading payout report');
    }
  };

  // ===== NEW: Farmer verification + detail =====
  const handleToggleFarmerVerification = async (farmerId) => {
    try {
      await API.patch(`/fpo/farmers/${farmerId}/verify`);
      fetchFarmers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating verification');
    }
  };

  const openFarmerDetail = async (farmerId) => {
    try {
      const res = await API.get(`/fpo/farmers/${farmerId}`);
      setFarmerDetail(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Error loading farmer detail');
    }
  };

  const handleAddFarmer = async (e) => {
    e.preventDefault();
    try {
      await API.post('/fpo/farmers', farmerForm);
      setFarmerForm({ name: '', phone: '', address: '', aadhaarNumber: '' });
      fetchFarmers();
      fetchAnalytics();
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding farmer');
    }
  };

  // NEW: wired up to the existing PATCH /fpo/farmers/:farmerId/status endpoint
  const handleToggleFarmerStatus = async (farmerId) => {
    try {
      await API.patch(`/fpo/farmers/${farmerId}/status`);
      fetchFarmers();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating farmer status');
    }
  };

  // NEW: wired up to the existing POST /fpo/farmers/import-csv endpoint
  const handleCsvImport = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    setCsvUploading(true);
    setCsvResult('');
    try {
      const form = new FormData();
      form.append('file', csvFile);
      const res = await API.post('/fpo/farmers/import-csv', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCsvResult(res.data.message || 'Import complete');
      setCsvFile(null);
      fetchFarmers();
      fetchAnalytics();
    } catch (err) {
      setCsvResult(err.response?.data?.message || 'Error importing CSV');
    } finally {
      setCsvUploading(false);
    }
  };

  const handleCreateIntake = async (e) => {
    e.preventDefault();
    try {
      await API.post('/fpo/batches/intake', intakeForm);
      setIntakeForm({ farmerId: '', produceType: '', rawQuantityKg: '', harvestDate: '' });
      fetchBatches();
      fetchAnalytics();
    } catch (err) {
      alert(err.response?.data?.message || 'Error recording intake');
    }
  };

  // UPDATED: now sends multipart/form-data so quality images actually reach
  // the existing upload.array('qualityImages', 5) middleware, and includes
  // the status dropdown (Approved/Rejected/Pending) instead of always
  // sending "Approved".
  const handleGradeBatch = async (e) => {
    e.preventDefault();
    try {
      const form = new FormData();
      form.append('gradeA_Kg', Number(gradingForm.gradeA_Kg));
      form.append('gradeB_Kg', Number(gradingForm.gradeB_Kg));
      form.append('gradeC_Kg', Number(gradingForm.gradeC_Kg));
      form.append('qualityScore', Number(gradingForm.qualityScore));
      form.append('status', gradingForm.status);
      gradingImages.forEach((file) => form.append('qualityImages', file));

      await API.patch(`/fpo/batches/${gradingForm.batchId}/grade`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert('Batch graded successfully! Inventory updated.');
      setGradingForm({ batchId: '', gradeA_Kg: 0, gradeB_Kg: 0, gradeC_Kg: 0, qualityScore: 8.5, status: 'Approved' });
      setGradingImages([]);
      fetchBatches();
      fetchInventory();
      fetchAnalytics();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating batch grade');
    }
  };

  const handleCreatePayout = async (e) => {
    e.preventDefault();
    try {
      await API.post('/fpo/payouts', {
        ...payoutForm,
        amount: Number(payoutForm.amount),
      });
      setPayoutForm({ farmerId: '', batchId: '', amount: '', transactionId: '' });
      fetchPayouts();
      fetchAnalytics();
    } catch (err) {
      alert(err.response?.data?.message || 'Error recording payout');
    }
  };

  // NEW: wired up to the existing POST /fpo/kyc endpoint (upload.array('documents', 5))
  const handleKycUpload = async (e) => {
    e.preventDefault();
    if (kycFiles.length === 0) return;
    setKycUploading(true);
    try {
      const form = new FormData();
      kycFiles.forEach((file) => form.append('documents', file));
      const res = await API.post('/fpo/kyc', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFpoProfile(res.data.fpo);
      setKycFiles([]);
      alert('KYC documents uploaded. Status: ' + res.data.fpo.kycStatus);
    } catch (err) {
      alert(err.response?.data?.message || 'Error uploading KYC documents');
    } finally {
      setKycUploading(false);
    }
  };

  // NEW: wired up to the existing POST /fpo/staff endpoint
  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await API.post('/fpo/staff', staffForm);
      setStaffForm({ name: '', email: '', password: '', location: '' });
      fetchProfile(); // refresh profile so the new staff shows in the populated list
      alert('Staff member added successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding staff member');
    }
  };

  // --- Loading state while we check for an existing FPO profile ---
  if (fpoProfile === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">
        Loading FPO dashboard...
      </div>
    );
  }

  // --- Registration gate: no FPO profile yet, show the onboarding form ---
  if (fpoProfile === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <form
          onSubmit={handleRegisterFpo}
          className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 w-full max-w-md space-y-4"
        >
          <h2 className="text-xl font-bold text-gray-800">Register your FPO</h2>
          <p className="text-sm text-gray-500">
            We couldn't find an FPO profile linked to your account yet. Fill this in to get started.
          </p>
          <input
            type="text"
            placeholder="FPO Name"
            value={profileForm.name}
            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <input
            type="text"
            placeholder="Registration Number"
            value={profileForm.registrationNumber}
            onChange={(e) => setProfileForm({ ...profileForm, registrationNumber: e.target.value })}
            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <input
            type="text"
            placeholder="Contact Phone"
            value={profileForm.phone}
            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <input
            type="email"
            placeholder="Contact Email"
            value={profileForm.email}
            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <input
            type="text"
            placeholder="Address"
            value={profileForm.address}
            onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <button className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition">
            Register FPO
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-emerald-900 text-white flex flex-col">
        <div className="p-6 text-2xl font-bold border-b border-emerald-800 flex items-center gap-2">
          <span>🌱</span> FarmFresh FPO
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {['analytics', 'farmers', 'intake', 'inventory', 'listings', 'orders', 'payouts', 'reports', 'settings', 'completion'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-2.5 rounded-lg font-medium transition-colors ${
                activeTab === tab ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-800 text-emerald-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        {/* NEW: Notification bell — floats top-right of every tab */}
        <div className="flex justify-end mb-4 relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative bg-white border border-gray-200 rounded-full p-2.5 shadow-sm hover:shadow-md transition"
          >
            🔔
            {notifications.some((n) => !n.isRead) && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {notifications.filter((n) => !n.isRead).length}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute top-12 right-0 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-30 max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center p-3 border-b">
                <span className="font-semibold text-gray-700 text-sm">Notifications</span>
                <button onClick={handleMarkAllRead} className="text-xs text-emerald-700 hover:underline">Mark all read</button>
              </div>
              {notifications.length === 0 && <p className="p-4 text-sm text-gray-400">No notifications yet.</p>}
              {notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => !n.isRead && handleMarkNotificationRead(n._id)}
                  className={`p-3 border-b text-sm cursor-pointer ${n.isRead ? 'text-gray-500' : 'text-gray-800 bg-emerald-50'}`}
                >
                  <p>{n.message}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'completion' && (
          <FpoCompletionPanel profile={fpoProfile} farmers={farmers} batches={batches} onRefresh={fetchProfile} />
        )}

        {/* Tab 1: Analytics */}
        {activeTab === 'analytics' && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">FPO Operations Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Registered Farmers</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{analytics.totalFarmers || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Batches Collected</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{analytics.totalBatches || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Available Stock</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{analytics.totalStockKg || 0} kg</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Distributed Payouts</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">₹{analytics.totalPayoutsDistributed || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Farmers Management */}
        {activeTab === 'farmers' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Farmer Onboarding & Management</h2>
            <form onSubmit={handleAddFarmer} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 gap-4">
              <h3 className="col-span-2 font-semibold text-gray-700 text-base border-b pb-2">Add a single farmer</h3>
              <input
                type="text"
                placeholder="Farmer Full Name"
                value={farmerForm.name}
                onChange={(e) => setFarmerForm({...farmerForm, name: e.target.value})}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <input
                type="text"
                placeholder="Phone Number"
                value={farmerForm.phone}
                onChange={(e) => setFarmerForm({...farmerForm, phone: e.target.value})}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <input
                type="text"
                placeholder="Village / Location"
                value={farmerForm.address}
                onChange={(e) => setFarmerForm({...farmerForm, address: e.target.value})}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="text"
                placeholder="Aadhaar Number"
                value={farmerForm.aadhaarNumber}
                onChange={(e) => setFarmerForm({...farmerForm, aadhaarNumber: e.target.value})}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button className="col-span-2 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition">
                Register Farmer
              </button>
            </form>

            {/* NEW: CSV bulk import — backend endpoint already existed, no UI until now */}
            <form onSubmit={handleCsvImport} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-3">
              <h3 className="font-semibold text-gray-700 text-base border-b pb-2">Bulk import via CSV</h3>
              <p className="text-xs text-gray-500">
                CSV columns expected: name, phone, aadhaarNumber, address, accountNumber, ifscCode, bankName. Only "name" and "phone" are required per row.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files[0] || null)}
                className="block w-full text-sm text-gray-600"
              />
              <button
                disabled={!csvFile || csvUploading}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {csvUploading ? 'Importing...' : 'Import Farmers'}
              </button>
              {csvResult && <p className="text-sm text-gray-600">{csvResult}</p>}
            </form>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-sm font-semibold text-gray-600">Name</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Phone</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Location</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Verified</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {farmers.map((f) => (
                    <tr key={f._id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-800">
                        <button onClick={() => openFarmerDetail(f._id)} className="hover:underline hover:text-emerald-700">
                          {f.name}
                        </button>
                      </td>
                      <td className="p-4 text-gray-600">{f.phone}</td>
                      <td className="p-4 text-gray-600">{f.address || 'N/A'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${f.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {f.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        {/* NEW: wired to PATCH /fpo/farmers/:farmerId/verify */}
                        <button
                          onClick={() => handleToggleFarmerVerification(f._id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${f.isVerified ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {f.isVerified ? 'Verified' : 'Unverified'}
                        </button>
                      </td>
                      <td className="p-4">
                        {/* NEW: wired to PATCH /fpo/farmers/:farmerId/status */}
                        <button
                          onClick={() => handleToggleFarmerStatus(f._id)}
                          className="text-sm font-medium text-emerald-700 hover:underline"
                        >
                          {f.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {farmers.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-gray-500">No farmers registered yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* NEW: Farmer detail modal — produce & payout history */}
            {farmerDetail && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 px-4" onClick={() => setFarmerDetail(null)}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{farmerDetail.farmer.name}</h3>
                      <p className="text-sm text-gray-500">{farmerDetail.farmer.phone} · {farmerDetail.farmer.address}</p>
                    </div>
                    <button onClick={() => setFarmerDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-500">Total Intake</p>
                      <p className="text-lg font-bold text-emerald-700">{farmerDetail.totalIntakeKg} kg</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-500">Total Paid Out</p>
                      <p className="text-lg font-bold text-emerald-700">₹{farmerDetail.totalPaid}</p>
                    </div>
                  </div>

                  <h4 className="font-semibold text-gray-700 text-sm mb-2">Produce History</h4>
                  <div className="space-y-2 mb-4">
                    {farmerDetail.batches.length === 0 && <p className="text-sm text-gray-400">No batches yet.</p>}
                    {farmerDetail.batches.map((b) => (
                      <div key={b._id} className="border rounded-lg p-2 text-sm">
                        <span className="font-medium">{b.batchId}</span> — {b.produceType}, {b.rawQuantityKg}kg
                        <span className="text-xs text-gray-500 ml-2">({b.grading?.status || 'Pending'})</span>
                      </div>
                    ))}
                  </div>

                  <h4 className="font-semibold text-gray-700 text-sm mb-2">Payout History</h4>
                  <div className="space-y-2">
                    {farmerDetail.payouts.length === 0 && <p className="text-sm text-gray-400">No payouts yet.</p>}
                    {farmerDetail.payouts.map((p) => (
                      <div key={p._id} className="border rounded-lg p-2 text-sm flex justify-between">
                        <span>₹{p.amount} {p.batch ? `(${p.batch.batchId})` : ''}</span>
                        <span className="text-xs text-gray-500">{p.status}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-gray-400 mt-4">
                    Note: once produce is graded it merges into pooled inventory by produce type and grade, so exact "sales" per farmer beyond this batch/payout history isn't tracked.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Produce Intake & Batch Quality Grading */}
        {activeTab === 'intake' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Produce Intake & QR Generation</h2>

            {/* Form 1: Intake Form */}
            <form onSubmit={handleCreateIntake} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 gap-4">
              <h3 className="col-span-2 font-semibold text-gray-700 text-base border-b pb-2">1. Record Raw Intake</h3>
              <select
                value={intakeForm.farmerId}
                onChange={(e) => setIntakeForm({...intakeForm, farmerId: e.target.value})}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">Select Farmer</option>
                {farmers.map((f) => (
                  <option key={f._id} value={f._id}>{f.name} ({f.phone})</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Produce Type (e.g. Tomatoes, Wheat)"
                value={intakeForm.produceType}
                onChange={(e) => setIntakeForm({...intakeForm, produceType: e.target.value})}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <input
                type="number"
                placeholder="Raw Quantity (Kg)"
                value={intakeForm.rawQuantityKg}
                onChange={(e) => setIntakeForm({...intakeForm, rawQuantityKg: e.target.value})}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <input
                type="date"
                value={intakeForm.harvestDate}
                onChange={(e) => setIntakeForm({...intakeForm, harvestDate: e.target.value})}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button className="col-span-2 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition">
                Generate Batch & Record Intake
              </button>
            </form>

            {/* Form 2: Batch Quality Grading Panel */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-700 text-base border-b pb-2 mb-4">2. Grade Existing Batch Quality</h3>
              <form onSubmit={handleGradeBatch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={gradingForm.batchId}
                  onChange={(e) => setGradingForm({ ...gradingForm, batchId: e.target.value })}
                  className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 md:col-span-3"
                  required
                >
                  <option value="">Select Batch to Grade</option>
                  {batches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.batchId} - {b.produceType} ({b.rawQuantityKg} kg) - Status: {b.status || 'Pending'}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Grade A (Kg)"
                  value={gradingForm.gradeA_Kg}
                  onChange={(e) => setGradingForm({ ...gradingForm, gradeA_Kg: e.target.value })}
                  className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <input
                  type="number"
                  placeholder="Grade B (Kg)"
                  value={gradingForm.gradeB_Kg}
                  onChange={(e) => setGradingForm({ ...gradingForm, gradeB_Kg: e.target.value })}
                  className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <input
                  type="number"
                  placeholder="Grade C (Kg)"
                  value={gradingForm.gradeC_Kg}
                  onChange={(e) => setGradingForm({ ...gradingForm, gradeC_Kg: e.target.value })}
                  className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />

                <input
                  type="number"
                  step="0.1"
                  max="10"
                  placeholder="Quality Score (out of 10)"
                  value={gradingForm.qualityScore}
                  onChange={(e) => setGradingForm({ ...gradingForm, qualityScore: e.target.value })}
                  className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />

                {/* NEW: status dropdown — previously always sent "Approved" no matter what */}
                <select
                  value={gradingForm.status}
                  onChange={(e) => setGradingForm({ ...gradingForm, status: e.target.value })}
                  className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Approved">Approve</option>
                  <option value="Rejected">Reject</option>
                  <option value="Pending">Keep Pending</option>
                </select>

                {/* NEW: quality images — backend already accepted up to 5 files, no UI until now */}
                <div className="md:col-span-3">
                  <label className="block text-sm text-gray-600 mb-1">Quality Images (up to 5)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setGradingImages(Array.from(e.target.files).slice(0, 5))}
                    className="block w-full text-sm text-gray-600"
                  />
                  {gradingImages.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{gradingImages.length} file(s) selected</p>
                  )}
                </div>

                <button className="md:col-span-3 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition">
                  Submit Batch Grading & Update Inventory
                </button>
              </form>
            </div>

            {/* Existing Batches List */}
            <h3 className="text-xl font-bold text-gray-800 pt-2">Registered Batches</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {batches.map((b) => (
                <div key={b._id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg text-emerald-800">{b.batchId}</h3>
                    <p className="text-sm text-gray-600 mt-1">Produce: {b.produceType}</p>
                    <p className="text-sm text-gray-600">Farmer: {b.farmer?.name || 'N/A'}</p>
                    <p className="text-sm text-gray-600">Quantity: {b.rawQuantityKg} kg</p>
                    <p className="text-sm font-semibold text-emerald-600 mt-1">Status: {b.grading?.status || 'Pending'}</p>
                    {b.grading?.qualityImages?.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {b.grading.qualityImages.slice(0, 3).map((path, i) => (
                          <img
                            key={i}
                            src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}/${path.replace(/^.*uploads/, 'uploads')}`}
                            alt="Quality"
                            className="w-10 h-10 object-cover rounded border"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {b.qrCodeUrl && (
                    <img src={b.qrCodeUrl} alt="Batch QR Code" className="w-24 h-24 rounded-md border p-1" />
                  )}
                </div>
              ))}
              {batches.length === 0 && (
                <p className="text-gray-500 col-span-2">No batches recorded yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Inventory */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Current Stock Inventory</h2>

            {/* NEW: low-stock alerts */}
            {lowStockAlerts.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="font-semibold text-red-700 text-sm mb-1">⚠ Low Stock Alerts</p>
                {lowStockAlerts.map((i) => (
                  <p key={i._id} className="text-sm text-red-600">
                    {i.produceType} (Grade {i.grade}): only {i.freeStock}kg free (threshold {i.minAlertThreshold}kg)
                  </p>
                ))}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-sm font-semibold text-gray-600">Produce</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Grade</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Total Stock (Kg)</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Reserved (Kg)</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Sold (Kg)</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Free (Kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((i) => (
                    <tr key={i._id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-800">{i.produceType}</td>
                      <td className="p-4 font-semibold text-emerald-700">Grade {i.grade}</td>
                      <td className="p-4 text-gray-700">{i.totalQuantity} kg</td>
                      <td className="p-4 text-gray-700">{i.reservedQuantity} kg</td>
                      <td className="p-4 text-gray-700">{i.soldQuantity} kg</td>
                      <td className="p-4 text-gray-700 font-semibold">{i.totalQuantity - i.reservedQuantity - i.soldQuantity} kg</td>
                    </tr>
                  ))}
                  {inventory.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-gray-500">No graded stock available in inventory.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* NEW: stock movement history */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <h3 className="font-semibold text-gray-700 text-base p-4 border-b">Stock Movement History</h3>
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 text-sm font-semibold text-gray-600">Date</th>
                    <th className="p-3 text-sm font-semibold text-gray-600">Type</th>
                    <th className="p-3 text-sm font-semibold text-gray-600">Produce</th>
                    <th className="p-3 text-sm font-semibold text-gray-600">Grade</th>
                    <th className="p-3 text-sm font-semibold text-gray-600">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {stockMovements.slice(0, 30).map((m) => (
                    <tr key={m._id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-gray-500 text-sm">{new Date(m.createdAt).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          m.type === 'Intake' ? 'bg-green-100 text-green-700' :
                          m.type === 'Sold' ? 'bg-blue-100 text-blue-700' :
                          m.type === 'Cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{m.type}</span>
                      </td>
                      <td className="p-3 text-gray-700 text-sm">{m.produceType}</td>
                      <td className="p-3 text-gray-700 text-sm">{m.grade}</td>
                      <td className="p-3 text-gray-700 text-sm">{m.quantityKg} kg</td>
                    </tr>
                  ))}
                  {stockMovements.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-gray-500">No stock movements recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* NEW Tab: Listings (linked to Inventory) */}
        {activeTab === 'listings' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Product Listings</h2>
            <form onSubmit={handleCreateListing} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 gap-4">
              <h3 className="col-span-2 font-semibold text-gray-700 text-base border-b pb-2">Create a listing from your graded stock</h3>
              <input
                type="text"
                placeholder="Produce Type (must match Inventory, e.g. Tomato)"
                value={listingForm.produceType}
                onChange={(e) => setListingForm({ ...listingForm, produceType: e.target.value })}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <select
                value={listingForm.grade}
                onChange={(e) => setListingForm({ ...listingForm, grade: e.target.value })}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
                <option value="Custom">Custom</option>
              </select>
              <input
                type="number"
                placeholder="Price per Kg (₹)"
                value={listingForm.pricePerKg}
                onChange={(e) => setListingForm({ ...listingForm, pricePerKg: e.target.value })}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <input
                type="number"
                placeholder="Quantity to List (Kg)"
                value={listingForm.availableQuantityKg}
                onChange={(e) => setListingForm({ ...listingForm, availableQuantityKg: e.target.value })}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <input
                type="number"
                placeholder="Minimum Order Qty (Kg)"
                value={listingForm.minOrderQtyKg}
                onChange={(e) => setListingForm({ ...listingForm, minOrderQtyKg: e.target.value })}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={listingForm.description}
                onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select value={listingForm.sourceBatch} onChange={(e) => setListingForm({ ...listingForm, sourceBatch: e.target.value })} className="p-2.5 border rounded-lg">
                <option value="">Source batch (optional)</option>
                {batches.filter((b) => b.grading?.status === 'Approved' && b.produceType === listingForm.produceType).map((b) => (
                  <option key={b._id} value={b._id}>{b.batchId}</option>
                ))}
              </select>
              <input type="file" accept="image/*" multiple onChange={(e) => setListingImages(Array.from(e.target.files || []).slice(0, 5))} className="p-2.5 border rounded-lg" />
              <button className="col-span-2 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition">
                Create Listing (reserves stock from Inventory)
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {listings.map((l) => (
                <div key={l._id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-emerald-800">{l.produceType} — Grade {l.grade}</h3>
                      <p className="text-sm text-gray-600">₹{l.pricePerKg}/kg · {l.availableQuantityKg}kg available</p>
                      <p className="text-xs text-gray-400">Min order: {l.minOrderQtyKg}kg</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      l.status === 'Published' ? 'bg-green-100 text-green-700' :
                      l.status === 'Paused' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{l.status}</span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {l.status !== 'Published' && (
                      <button onClick={() => handleSetListingStatus(l._id, 'Published')} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700">
                        Publish
                      </button>
                    )}
                    {l.status === 'Published' && (
                      <button onClick={() => handleSetListingStatus(l._id, 'Paused')} className="text-xs bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600">
                        Pause
                      </button>
                    )}
                    <button onClick={() => handleDeleteListing(l._id)} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {listings.length === 0 && <p className="text-gray-500 col-span-2">No listings created yet.</p>}
            </div>
          </div>
        )}

        {/* NEW Tab: Orders (consumer orders against listings) */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Incoming Orders</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-sm font-semibold text-gray-600">Produce</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Consumer</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Qty</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Total</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fpoOrders.map((o) => (
                    <tr key={o._id} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-gray-800">{o.listing?.produceType} (Grade {o.listing?.grade})</td>
                      <td className="p-4 text-gray-600">{o.consumer?.name}</td>
                      <td className="p-4 text-gray-600">{o.quantityKg} kg</td>
                      <td className="p-4 text-gray-600">₹{o.totalPrice}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          o.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                          o.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                          o.status === 'Dispatched' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{o.status}</span>
                      </td>
                      <td className="p-4">
                        {o.status !== 'Delivered' && o.status !== 'Cancelled' && (
                          <div className="flex flex-col gap-1">
                            <select
                              onChange={(e) => e.target.value && handleUpdateOrderStatus(o._id, e.target.value)}
                              defaultValue=""
                              className="text-xs border rounded p-1"
                            >
                              <option value="" disabled>Advance status...</option>
                              {o.status === 'Placed' && <option value="Accepted">Accept Order</option>}
                              {o.status === 'Placed' && <option value="Rejected">Reject Order</option>}
                              {o.status === 'Accepted' && <option value="Packed">Mark Packed</option>}
                              {o.status === 'Packed' && <option value="Dispatched">Mark Dispatched</option>}
                              {o.status === 'Dispatched' && <option value="Delivered">Mark Delivered</option>}
                            </select>
                            <button onClick={() => handleCancelOrder(o._id)} className="text-xs text-red-600 hover:underline">
                              Cancel Order
                            </button>
                            {(o.status === 'Cancelled' || o.status === 'Rejected') && o.refundStatus !== 'Processed' && (
                              <button onClick={async () => { try { await API.patch(`/fpo-orders/${o._id}/refund`, { refundTransactionId: prompt('Refund transaction ID') || undefined }); fetchFpoOrders(); } catch (err) { alert(err.response?.data?.message || 'Refund failed'); } }} className="text-xs text-blue-600 hover:underline">
                                Mark Refund Processed
                              </button>
                            )}
                          </div>
                        )}
                        {(o.status === 'Cancelled' || o.status === 'Rejected') && o.refundStatus !== 'Processed' && (
                          <button onClick={async () => { try { await API.patch(`/fpo-orders/${o._id}/refund`, { refundTransactionId: prompt('Refund transaction ID') || undefined }); fetchFpoOrders(); } catch (err) { alert(err.response?.data?.message || 'Refund failed'); } }} className="text-xs text-blue-600 hover:underline mt-1">
                            Mark Refund Processed
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {fpoOrders.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-gray-500">No orders yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Payouts */}
        {activeTab === 'payouts' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Farmer Payouts</h2>
            <form onSubmit={handleCreatePayout} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-2 gap-4">
              <select
                value={payoutForm.farmerId}
                onChange={(e) => setPayoutForm({ ...payoutForm, farmerId: e.target.value })}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">Select Farmer</option>
                {farmers.map((f) => (
                  <option key={f._id} value={f._id}>{f.name} ({f.phone})</option>
                ))}
              </select>
              <select
                value={payoutForm.batchId}
                onChange={(e) => setPayoutForm({ ...payoutForm, batchId: e.target.value })}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Batch (optional)</option>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>{b.batchId} - {b.produceType}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Amount (₹)"
                value={payoutForm.amount}
                onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <input
                type="text"
                placeholder="Transaction ID (leave blank if pending)"
                value={payoutForm.transactionId}
                onChange={(e) => setPayoutForm({ ...payoutForm, transactionId: e.target.value })}
                className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button className="col-span-2 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition">
                Record Payout
              </button>
            </form>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-sm font-semibold text-gray-600">Farmer</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Batch</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Amount</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p._id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-800">{p.farmer?.name || 'N/A'}</td>
                      <td className="p-4 text-gray-600">{p.batch?.batchId || '—'}</td>
                      <td className="p-4 text-gray-700">₹{p.amount}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          p.status === 'Failed' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {payouts.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-gray-500">No payouts recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* NEW Tab: Reports */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Reports & Analytics</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">₹{salesReport.totalRevenue}</p>
                <p className="text-xs text-gray-400 mt-1">{salesReport.totalOrders || 0} orders</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">FPO Earnings (Settlement)</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">₹{settlement.totalEarnings}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <p className="text-sm text-gray-500">Payout Report</p>
                <button onClick={handleDownloadPayoutReport} className="mt-2 bg-emerald-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-emerald-700 w-fit">
                  Download CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-700 mb-3">Best-Selling Produce</h3>
                {salesReport.bestSelling?.length === 0 && <p className="text-sm text-gray-400">No sales yet.</p>}
                {salesReport.bestSelling?.map((b) => (
                  <div key={b.produceType} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                    <span>{b.produceType}</span>
                    <span className="font-semibold">{b.quantityKg} kg</span>
                  </div>
                ))}
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-700 mb-3">Grade Distribution (Sold)</h3>
                {salesReport.gradeDistribution?.length === 0 && <p className="text-sm text-gray-400">No sales yet.</p>}
                {salesReport.gradeDistribution?.map((g) => (
                  <div key={g.grade} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                    <span>Grade {g.grade}</span>
                    <span className="font-semibold">{g.quantityKg} kg</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-3">Farmer-wise Performance</h3>
              <table className="w-full text-left border-collapse">
                <thead className="border-b">
                  <tr>
                    <th className="p-2 text-sm font-semibold text-gray-600">Farmer</th>
                    <th className="p-2 text-sm font-semibold text-gray-600">Phone</th>
                    <th className="p-2 text-sm font-semibold text-gray-600">Batches</th>
                    <th className="p-2 text-sm font-semibold text-gray-600">Total Kg</th>
                  </tr>
                </thead>
                <tbody>
                  {farmerPerformance.map((f) => (
                    <tr key={f.farmerId} className="border-b">
                      <td className="p-2 text-sm">{f.name}</td>
                      <td className="p-2 text-sm text-gray-500">{f.phone}</td>
                      <td className="p-2 text-sm">{f.totalBatches}</td>
                      <td className="p-2 text-sm font-semibold">{f.totalKg} kg</td>
                    </tr>
                  ))}
                  {farmerPerformance.length === 0 && (
                    <tr><td colSpan="4" className="p-4 text-center text-gray-400 text-sm">No data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-3">Monthly Summary</h3>
              <table className="w-full text-left border-collapse">
                <thead className="border-b">
                  <tr>
                    <th className="p-2 text-sm font-semibold text-gray-600">Month</th>
                    <th className="p-2 text-sm font-semibold text-gray-600">Intake (Kg)</th>
                    <th className="p-2 text-sm font-semibold text-gray-600">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyReport.map((m) => (
                    <tr key={m.month} className="border-b">
                      <td className="p-2 text-sm">{m.month}</td>
                      <td className="p-2 text-sm">{m.intakeKg} kg</td>
                      <td className="p-2 text-sm">₹{m.revenue}</td>
                    </tr>
                  ))}
                  {monthlyReport.length === 0 && (
                    <tr><td colSpan="3" className="p-4 text-center text-gray-400 text-sm">No data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: Settings — NEW. KYC upload + staff management both already had
            working backend endpoints (POST /fpo/kyc, POST /fpo/staff) with no UI. */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">FPO Settings</h2>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-700 text-base border-b pb-2 mb-4">FPO Profile</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p className="text-gray-500">Name</p><p className="text-gray-800">{fpoProfile.name}</p>
                <p className="text-gray-500">Registration No.</p><p className="text-gray-800">{fpoProfile.registrationNumber}</p>
                <p className="text-gray-500">KYC Status</p>
                <p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    fpoProfile.kycStatus === 'Verified' ? 'bg-green-100 text-green-700' :
                    fpoProfile.kycStatus === 'Rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {fpoProfile.kycStatus}
                  </span>
                </p>
                <p className="text-gray-500">Contact Phone</p><p className="text-gray-800">{fpoProfile.contactDetails?.phone || '—'}</p>
                <p className="text-gray-500">Contact Email</p><p className="text-gray-800">{fpoProfile.contactDetails?.email || '—'}</p>
                <p className="text-gray-500">Address</p><p className="text-gray-800">{fpoProfile.contactDetails?.address || '—'}</p>
              </div>
            </div>

            {/* NEW: KYC document upload */}
            <form onSubmit={handleKycUpload} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-3">
              <h3 className="font-semibold text-gray-700 text-base border-b pb-2">Upload KYC Documents</h3>
              <p className="text-xs text-gray-500">Up to 5 files (registration certificate, PAN, bank proof, etc.)</p>
              <input
                type="file"
                multiple
                onChange={(e) => setKycFiles(Array.from(e.target.files).slice(0, 5))}
                className="block w-full text-sm text-gray-600"
              />
              {kycFiles.length > 0 && <p className="text-xs text-gray-500">{kycFiles.length} file(s) selected</p>}
              <button
                disabled={kycFiles.length === 0 || kycUploading}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {kycUploading ? 'Uploading...' : 'Upload Documents'}
              </button>
              {fpoProfile.kycDocuments?.length > 0 && (
                <p className="text-xs text-gray-500">{fpoProfile.kycDocuments.length} document(s) already on file.</p>
              )}
            </form>

            {/* NEW: Staff management */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-700 text-base border-b pb-2 mb-4">Staff Members</h3>
              <form onSubmit={handleAddStaff} className="grid grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Staff Full Name"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <input
                  type="password"
                  placeholder="Temporary Password"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Location"
                  value={staffForm.location}
                  onChange={(e) => setStaffForm({ ...staffForm, location: e.target.value })}
                  className="p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <button className="col-span-2 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition">
                  Add Staff Member
                </button>
              </form>

              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 text-sm font-semibold text-gray-600">Name</th>
                    <th className="p-3 text-sm font-semibold text-gray-600">Email</th>
                    <th className="p-3 text-sm font-semibold text-gray-600">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {(fpoProfile.staff || []).map((s) => (
                    <tr key={s._id} className="border-b">
                      <td className="p-3 text-gray-800">{s.name}</td>
                      <td className="p-3 text-gray-600">{s.email}</td>
                      <td className="p-3 text-gray-600">{s.location}</td>
                    </tr>
                  ))}
                  {(!fpoProfile.staff || fpoProfile.staff.length === 0) && (
                    <tr>
                      <td colSpan="3" className="p-4 text-center text-gray-500">No staff added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
