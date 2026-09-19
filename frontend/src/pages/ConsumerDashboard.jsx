import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CartDrawer from '../components/CartDrawer';
import CheckoutModal from '../components/CheckoutModal';
import OrderTrackingModal from '../components/OrderTrackingModal';
import ReviewModal from '../components/ReviewModal';
import NotificationBell from '../components/NotificationBell';
import SubscriptionModal from '../components/SubscriptionModal';
import InvoiceModal from '../components/InvoiceModal';
import TraceabilityModal from '../components/TraceabilityModal';
import HelpSupportModal from '../components/HelpSupportModal';

export default function ConsumerDashboard() {
  const { user, logout, updateUser } = useAuth();
  const {
    addToCart,
    cartCount,
    wishlist,
    toggleWishlist,
    isInWishlist,
    setIsCartOpen,
  } = useCart();
  const navigate = useNavigate();

  // FPO Marketplace
  const [fpoListings, setFpoListings] = useState([]);
  const [fpoOrders, setFpoOrders] = useState([]);
  const [fpoQuantities, setFpoQuantities] = useState({});
  const [buyerType, setBuyerType] = useState('INDIVIDUAL');

  // Filters for FPO marketplace
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const [tab, setTab] = useState('fpoMarket');
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);

  const openOrderTracking = (order) => {
    setTrackingOrder(order);
    setIsTrackingOpen(true);
  };

  const [reviewModalState, setReviewModalState] = useState({
    isOpen: false,
    targetType: 'Listing',
    targetId: null,
    productName: '',
    productImage: '',
    grade: '',
  });

  const openReviewModal = (targetType, targetId, productName, productImage = '', grade = '') => {
    setReviewModalState({
      isOpen: true,
      targetType,
      targetId,
      productName,
      productImage,
      grade,
    });
  };

  // Official Invoice Modal state
  const [invoiceModalOrder, setInvoiceModalOrder] = useState(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const openInvoiceModal = (order) => {
    setInvoiceModalOrder(order);
    setIsInvoiceOpen(true);
  };

  // Traceability & Help Modals
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Orders Search & Filtering state
  const [fpoSearchQuery, setFpoSearchQuery] = useState('');
  const [fpoStatusFilter, setFpoStatusFilter] = useState('ALL');

  // 1-Click Reorder handler
  const handleReorderItem = (order) => {
    const itemName = order.listing?.produceType || 'FPO Produce';
    const itemQty = order.quantityKg || 1;
    const itemPrice = order.totalPrice || 0;
    const itemGrade = order.gradeOrdered || order.listing?.grade || 'A';

    addToCart(
      {
        _id: order.listing?._id || order.listing,
        produceType: itemName,
        pricePerKg: itemQty > 0 ? Math.round(itemPrice / itemQty) : itemPrice,
        images: order.listing?.images || [],
        grade: itemGrade,
        minOrderQtyKg: 1,
        fpo: order.fpo,
        buyerType: order.buyerType || 'INDIVIDUAL',
      },
      itemQty
    );
    setSuccess(`${itemQty}kg of ${itemName} added to your cart!`);
    setIsCartOpen(true);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleNotificationSelectOrder = async (orderId) => {
    if (!orderId) return;
    const matchedFpo = fpoOrders.find((o) => o._id.toString() === orderId.toString());
    if (matchedFpo) {
      openOrderTracking(matchedFpo);
      setTab('fpoOrders');
      return;
    }
    try {
      const res = await API.get('/fpo-orders/mine');
      setFpoOrders(res.data);
      const found = res.data.find((o) => o._id.toString() === orderId.toString());
      if (found) {
        openOrderTracking(found);
        setTab('fpoOrders');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionModal, setSubscriptionModal] = useState({
    isOpen: false,
    item: null,
    itemType: 'FPO',
  });

  const openSubscriptionModal = (item, itemType = 'FPO') => {
    setSubscriptionModal({
      isOpen: true,
      item,
      itemType,
    });
  };

  const fetchSubscriptions = async () => {
    try {
      const res = await API.get('/subscriptions/mine');
      setSubscriptions(res.data || []);
    } catch (err) {
      console.error('Failed to load subscriptions', err);
    }
  };

  const handleToggleSubStatus = async (subId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
    try {
      await API.patch(`/subscriptions/${subId}/status`, { status: newStatus });
      setSuccess(`Subscription is now ${newStatus}`);
      fetchSubscriptions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update subscription');
    }
  };

  const handleSkipSubDelivery = async (subId) => {
    try {
      const res = await API.patch(`/subscriptions/${subId}/skip`);
      setSuccess(res.data?.message || 'Upcoming delivery skipped!');
      fetchSubscriptions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to skip delivery');
    }
  };

  const handleCancelSub = async (subId) => {
    if (!window.confirm('Are you sure you want to cancel this recurring subscription?')) return;
    try {
      await API.patch(`/subscriptions/${subId}/status`, { status: 'Cancelled' });
      setSuccess('Subscription cancelled');
      fetchSubscriptions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel subscription');
    }
  };

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Account & Profile state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    location: user?.location || '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Saved Addresses state
  const [addresses, setAddresses] = useState(user?.addresses || []);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    fullName: user?.name || '',
    phone: user?.phone || '',
    streetAddress: '',
    landmark: '',
    city: user?.location || '',
    state: '',
    pincode: '',
    isDefault: false,
  });
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressMsg, setAddressMsg] = useState({ type: '', text: '' });

  // Security / Password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  // ---------- Fetchers ----------
  const fetchProfile = async () => {
    try {
      const res = await API.get('/auth/profile');
      if (res.data) {
        setProfileData({
          name: res.data.name || '',
          phone: res.data.phone || '',
          location: res.data.location || '',
        });
        setAddresses(res.data.addresses || []);
        if (updateUser) updateUser(res.data);
      }
    } catch (err) {
      console.error('Failed to load profile', err);
    }
  };

  const fetchFpoListings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (gradeFilter !== 'ALL') params.append('grade', gradeFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (sortBy) params.append('sort', sortBy);

      const res = await API.get(`/listings/public?${params.toString()}`);
      setFpoListings(res.data);
    } catch (err) {
      console.error('Failed to load FPO listings', err);
    }
  }, [gradeFilter, searchQuery, sortBy]);

  const fetchFpoOrders = async () => {
    try {
      const res = await API.get('/fpo-orders/mine');
      setFpoOrders(res.data);
    } catch (err) {
      console.error('Failed to load FPO orders', err);
    }
  };

  useEffect(() => {
    fetchFpoOrders();
    fetchSubscriptions();
    fetchProfile();
  }, []);

  useEffect(() => {
    fetchFpoListings();
  }, [fetchFpoListings]);

  // ---------- Account Handlers ----------
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ type: '', text: '' });
    try {
      const res = await API.put('/auth/profile', profileData);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      if (updateUser) updateUser(res.data);
      setTimeout(() => setProfileMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile' });
    } finally {
      setProfileSaving(false);
    }
  };

  const openAddAddressModal = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: 'Home',
      fullName: profileData.name || user?.name || '',
      phone: profileData.phone || user?.phone || '',
      streetAddress: '',
      landmark: '',
      city: profileData.location || user?.location || '',
      state: '',
      pincode: '',
      isDefault: addresses.length === 0,
    });
    setAddressMsg({ type: '', text: '' });
    setAddressModalOpen(true);
  };

  const openEditAddressModal = (addr) => {
    setEditingAddressId(addr._id);
    setAddressForm({
      label: addr.label || 'Home',
      fullName: addr.fullName,
      phone: addr.phone,
      streetAddress: addr.streetAddress,
      landmark: addr.landmark || '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      isDefault: addr.isDefault || false,
    });
    setAddressMsg({ type: '', text: '' });
    setAddressModalOpen(true);
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setAddressSaving(true);
    setAddressMsg({ type: '', text: '' });
    try {
      let res;
      if (editingAddressId) {
        res = await API.put(`/auth/addresses/${editingAddressId}`, addressForm);
      } else {
        res = await API.post('/auth/addresses', addressForm);
      }
      setAddresses(res.data);
      if (updateUser) updateUser({ addresses: res.data });
      setAddressModalOpen(false);
      setSuccess(editingAddressId ? 'Address updated!' : 'Address added!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setAddressMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save address' });
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = async (addrId) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    try {
      const res = await API.delete(`/auth/addresses/${addrId}`);
      setAddresses(res.data);
      if (updateUser) updateUser({ addresses: res.data });
      setSuccess('Address deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete address');
    }
  };

  const handleSetDefaultAddress = async (addrId) => {
    try {
      const res = await API.put(`/auth/addresses/${addrId}/default`);
      setAddresses(res.data);
      if (updateUser) updateUser({ addresses: res.data });
      setSuccess('Default address updated');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update default address');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });
    if (passwordForm.newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setPasswordSaving(true);
    try {
      await API.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password' });
    } finally {
      setPasswordSaving(false);
    }
  };

  // ---------- Handlers ----------
  const handlePlaceFpoOrder = async (listing) => {
    const qty = Number(fpoQuantities[listing._id]);
    if (!qty || qty <= 0) {
      setError('Enter a valid quantity');
      return;
    }
    if (qty < listing.minOrderQtyKg) {
      setError(`Minimum order quantity is ${listing.minOrderQtyKg}kg`);
      return;
    }
    try {
      await API.post('/fpo-orders', {
        listingId: listing._id,
        quantityKg: qty,
        buyerType,
      });
      setSuccess(`Order placed successfully as ${buyerType}!`);
      setFpoQuantities({ ...fpoQuantities, [listing._id]: '' });
      fetchFpoListings();
      fetchFpoOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const statusColor = {
    placed: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
    Placed: 'bg-yellow-100 text-yellow-800',
    Accepted: 'bg-blue-100 text-blue-800',
    Packed: 'bg-indigo-100 text-indigo-800',
    Dispatched: 'bg-purple-100 text-purple-800',
    Delivered: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
    Rejected: 'bg-red-100 text-red-800',
    Refunded: 'bg-gray-100 text-gray-800',
  };

  const gradeColors = {
    A: 'bg-emerald-700 text-white',
    B: 'bg-amber-600 text-white',
    C: 'bg-orange-600 text-white',
    Custom: 'bg-slate-600 text-white',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-100 via-emerald-50 to-teal-100 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(21 128 61 / 0.25) 1.5px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="absolute -top-32 -right-32 w-[30rem] h-[30rem] bg-yellow-300 rounded-full blur-3xl opacity-40 pointer-events-none" />
      <div className="absolute top-1/3 -left-32 w-[28rem] h-[28rem] bg-emerald-300 rounded-full blur-3xl opacity-30 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur border-b border-emerald-100 sticky top-0">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌾</span>
            <h1 className="text-xl font-bold text-emerald-800">FarmFresh</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications Hub */}
            <NotificationBell onSelectOrder={handleNotificationSelectOrder} />

            {/* Produce Traceability Passport Modal Trigger */}
            <button
              onClick={() => setIsTraceOpen(true)}
              className="text-xs sm:text-sm font-medium flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200 transition"
              title="Trace Farm Origin & Quality Passport"
            >
              <span>🌱</span>
              <span className="hidden md:inline">Trace</span>
            </button>

            {/* Help & Support Modal Trigger */}
            <button
              onClick={() => setIsHelpOpen(true)}
              className="text-xs sm:text-sm font-medium flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 transition"
              title="Help & Customer Support"
            >
              <span>💬</span>
              <span className="hidden md:inline">Help</span>
            </button>

            <button
              onClick={() => setTab('wishlist')}
              className={`text-xs sm:text-sm font-medium flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border transition ${
                tab === 'wishlist'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
              }`}
            >
              <span>❤️</span>
              <span className="hidden sm:inline">Wishlist</span>
              {wishlist.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {wishlist.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="text-xs sm:text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700 transition shadow-sm"
            >
              <span>🛒</span>
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="bg-amber-400 text-gray-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                  {cartCount}kg
                </span>
              )}
            </button>

            <button
              onClick={() => setTab('account')}
              className={`text-xs sm:text-sm font-medium flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border transition ${
                tab === 'account'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              <span>👤</span>
              <span className="hidden sm:inline">{user?.name}</span>
            </button>

            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm bg-gray-700 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold">×</button>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="font-bold">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'fpoMarket', label: 'FPO Marketplace' },
            { id: 'fpoOrders', label: `FPO Orders${fpoOrders.length ? ` (${fpoOrders.length})` : ''}` },
            { id: 'subscriptions', label: `Subscriptions${subscriptions.length ? ` (${subscriptions.length})` : ''}` },
            { id: 'wishlist', label: `Wishlist${wishlist.length ? ` (${wishlist.length})` : ''}` },
            { id: 'account', label: 'My Account' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-emerald-700 text-white shadow'
                  : 'bg-white text-gray-600 hover:bg-emerald-50 border'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ==================== FPO MARKETPLACE ==================== */}
        {tab === 'fpoMarket' && (
          <div>
            {/* Filters Bar */}
            <div className="bg-white rounded-xl shadow-sm border p-4 mb-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Search crop (e.g. Tomato, Banana)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="newest">Newest first</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                  <option value="qty_desc">Highest stock</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500 mr-1">Grade:</span>
                {['ALL', 'A', 'B', 'C'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGradeFilter(g)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                      gradeFilter === g
                        ? g === 'ALL'
                          ? 'bg-emerald-700 text-white'
                          : gradeColors[g]
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {g === 'ALL' ? 'All Grades' : `Grade ${g}`}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                <span className="text-xs font-medium text-gray-500 mr-1">I am ordering as:</span>
                {[
                  { value: 'INDIVIDUAL', label: 'Individual' },
                  { value: 'KIRANA', label: 'Kirana Store' },
                  { value: 'RESTAURANT', label: 'Restaurant' },
                  { value: 'WHOLESALER', label: 'Wholesaler' },
                ].map((b) => (
                  <button
                    key={b.value}
                    onClick={() => setBuyerType(b.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      buyerType === b.value
                        ? 'bg-emerald-700 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Listings Grid */}
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
              {fpoListings.length === 0 && (
                <p className="text-gray-500 text-sm col-span-full">No matching FPO listings found.</p>
              )}

              {fpoListings.map((item) => (
                <div
                  key={item._id}
                  onClick={() => navigate(`/listing/${item._id}`)}
                  className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition cursor-pointer"
                >
                  <div className="h-36 bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center overflow-hidden relative">
                    <span
                      className={`absolute top-2 left-2 text-xs font-semibold px-2 py-1 rounded-full z-10 ${
                        gradeColors[item.grade] || 'bg-slate-600 text-white'
                      }`}
                    >
                      Grade {item.grade}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(item);
                      }}
                      title={isInWishlist(item._id) ? 'Remove from wishlist' : 'Save to wishlist'}
                      className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm text-xs transition"
                    >
                      {isInWishlist(item._id) ? '❤️' : '🤍'}
                    </button>
                    {item.images?.[0] ? (
                      <img
                        src={
                          item.images[0].startsWith('http')
                            ? item.images[0]
                            : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
                                .replace('/api', '')}/${item.images[0].replace(/^.*uploads/, 'uploads')}`
                        }
                        alt={item.produceType}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl">🌾</span>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">{item.produceType}</h3>
                    <p className="text-xs text-gray-500">{item.fpo?.name}</p>
                    <p className="text-green-700 font-bold mt-1">
                      ₹{item.pricePerKg}
                      <span className="text-xs font-normal text-gray-500">/kg</span>
                    </p>
                    <p className="text-xs text-gray-500 mb-1">
                      {item.availableQuantityKg}kg available · Min {item.minOrderQtyKg}kg
                    </p>
                    {item.description && (
                      <p className="text-xs text-gray-400 mb-2 line-clamp-2">{item.description}</p>
                    )}

                    <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        placeholder="kg"
                        value={fpoQuantities[item._id] || ''}
                        onChange={(e) =>
                          setFpoQuantities({ ...fpoQuantities, [item._id]: e.target.value })
                        }
                        className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                        min={item.minOrderQtyKg}
                        max={item.availableQuantityKg}
                        step={buyerType === 'INDIVIDUAL' ? 1 : 5}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const q = Number(fpoQuantities[item._id]) || item.minOrderQtyKg || 1;
                          addToCart(item, q, buyerType);
                        }}
                        disabled={item.availableQuantityKg === 0}
                        className="flex-1 bg-emerald-700 text-white text-xs py-1.5 rounded-lg hover:bg-emerald-800 disabled:bg-gray-300 transition font-medium flex items-center justify-center gap-1"
                      >
                        <span>🛒</span> Add
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaceFpoOrder(item);
                        }}
                        disabled={item.availableQuantityKg === 0}
                        className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs px-2.5 py-1.5 rounded-lg disabled:opacity-40 transition font-medium"
                      >
                        Buy
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openSubscriptionModal(item, 'FPO');
                        }}
                        disabled={item.availableQuantityKg === 0}
                        className="bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 text-[11px] px-2 py-1.5 rounded-lg transition font-semibold flex items-center gap-0.5"
                        title="Subscribe & Save 5% with recurring delivery"
                      >
                        <span>🔁</span> Sub
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== FPO ORDERS ==================== */}
        {tab === 'fpoOrders' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">My FPO Orders</h2>
                <p className="text-xs text-gray-500">Track order progress, view delivery receipts, and manage reorders</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                {fpoOrders.length} {fpoOrders.length === 1 ? 'Order' : 'Orders'}
              </span>
            </div>

            {/* FPO Orders Filter & Search Bar */}
            <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-200/80 mb-5 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Search produce, order ID, or FPO..."
                  value={fpoSearchQuery}
                  onChange={(e) => setFpoSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-7 py-1.5 text-xs outline-none focus:border-emerald-600"
                />
                <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
                {fpoSearchQuery && (
                  <button
                    onClick={() => setFpoSearchQuery('')}
                    className="absolute right-2.5 top-1 text-gray-400 hover:text-gray-600 text-sm font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                {[
                  { key: 'ALL', label: 'All Orders' },
                  { key: 'ACTIVE', label: 'In Progress' },
                  { key: 'Delivered', label: 'Delivered' },
                  { key: 'Cancelled', label: 'Cancelled' },
                ].map((st) => (
                  <button
                    key={st.key}
                    onClick={() => setFpoStatusFilter(st.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      fpoStatusFilter === st.key
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {(() => {
                const filtered = fpoOrders.filter((order) => {
                  if (fpoStatusFilter === 'ACTIVE') {
                    if (['Delivered', 'Cancelled', 'Rejected'].includes(order.status)) return false;
                  } else if (fpoStatusFilter === 'Delivered') {
                    if (order.status !== 'Delivered') return false;
                  } else if (fpoStatusFilter === 'Cancelled') {
                    if (!['Cancelled', 'Rejected'].includes(order.status)) return false;
                  }
                  if (fpoSearchQuery.trim()) {
                    const q = fpoSearchQuery.toLowerCase();
                    const name = (order.listing?.produceType || '').toLowerCase();
                    const id = (order._id || '').toLowerCase();
                    const fpoName = (order.fpo?.name || '').toLowerCase();
                    return name.includes(q) || id.includes(q) || fpoName.includes(q);
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl">
                      <span className="text-4xl">📦</span>
                      <p className="text-gray-500 text-sm mt-2 font-medium">
                        {fpoOrders.length === 0 ? 'No FPO orders placed yet.' : 'No orders match your search or filter.'}
                      </p>
                      {fpoOrders.length > 0 ? (
                        <button
                          onClick={() => {
                            setFpoSearchQuery('');
                            setFpoStatusFilter('ALL');
                          }}
                          className="mt-2 text-xs text-emerald-700 hover:underline font-semibold"
                        >
                          Clear filters
                        </button>
                      ) : (
                        <button
                          onClick={() => setTab('fpoMarket')}
                          className="mt-3 inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-lg transition"
                        >
                          Browse FPO Produce Market →
                        </button>
                      )}
                    </div>
                  );
                }

                return filtered.map((order) => {
                const isCancelled = ['Cancelled', 'Rejected'].includes(order.status);
                const isDelivered = order.status === 'Delivered';
                const canCancel = ['Placed', 'Accepted'].includes(order.status);

                const fpoSteps = ['Placed', 'Accepted', 'Packed', 'Dispatched', 'Delivered'];
                const stepIdx = fpoSteps.indexOf(order.status);

                return (
                  <div
                    key={order._id}
                    className="border border-gray-200 rounded-xl p-5 hover:border-emerald-300 transition shadow-sm bg-white"
                  >
                    {/* Top Row: Meta info & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          #{order._id.slice(-8).toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {order.buyerType && order.buyerType !== 'INDIVIDUAL' && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                            {order.buyerType}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {order.refundStatus && order.refundStatus !== 'NotRequired' && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Refund: {order.refundStatus}
                          </span>
                        )}
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                            statusColor[order.status] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Product info */}
                    <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-emerald-50 border flex items-center justify-center overflow-hidden flex-shrink-0">
                          {order.listing?.images?.[0] ? (
                            <img
                              src={
                                order.listing.images[0].startsWith('http')
                                  ? order.listing.images[0]
                                  : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
                                      .replace('/api', '')}/${order.listing.images[0].replace(/^.*uploads/, 'uploads')}`
                              }
                              alt={order.listing.produceType}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl">🌾</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900">
                              {order.listing?.produceType || 'FPO Produce'}
                            </h3>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Grade {order.gradeOrdered || order.listing?.grade || 'A'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            FPO: <span className="font-medium text-gray-700">{order.fpo?.name || 'Local FPO'}</span>
                            {order.deliverySlot && ` · Slot: ${order.deliverySlot}`}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Qty: <span className="font-semibold text-gray-800">{order.quantityKg} kg</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-lg font-bold text-emerald-800">₹{order.totalPrice}</p>
                        <p className="text-xs text-gray-400">
                          Paid via {order.paymentMethod || 'CARD'}
                        </p>
                      </div>
                    </div>

                    {/* Mini Visual Stepper (if not cancelled) */}
                    {!isCancelled && (
                      <div className="py-2.5 px-3 bg-gray-50/70 rounded-xl mb-4 border border-gray-100">
                        <div className="flex items-center justify-between text-[11px]">
                          {fpoSteps.map((stepName, idx) => {
                            const isDone = stepIdx > idx || stepIdx === fpoSteps.length - 1;
                            const isCurrent = stepIdx === idx && stepIdx !== fpoSteps.length - 1;

                            return (
                              <div key={stepName} className="flex items-center gap-1">
                                <span
                                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                    isDone
                                      ? 'bg-emerald-600 text-white'
                                      : isCurrent
                                      ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                                      : 'bg-gray-200 text-gray-400'
                                  }`}
                                >
                                  {isDone ? '✓' : idx + 1}
                                </span>
                                <span
                                  className={`font-medium hidden md:inline ${
                                    isDone || isCurrent ? 'text-gray-800' : 'text-gray-400'
                                  }`}
                                >
                                  {stepName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Cancellation reason banner if cancelled */}
                    {isCancelled && order.cancelReason && (
                      <div className="mb-4 p-2.5 bg-red-50 text-red-700 rounded-lg text-xs border border-red-100">
                        <span className="font-semibold">Cancellation Note:</span> {order.cancelReason}
                      </div>
                    )}

                    {/* Bottom Action Bar */}
                    <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Track Order Details */}
                        <button
                          onClick={() => openOrderTracking(order)}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
                        >
                          <span>🔍</span> Track Order & Receipt
                        </button>

                        {/* Batch Traceability Link */}
                        {(order.listing?.sourceBatch || order.listing?.sourceIntakeId) && (
                          <button
                            onClick={() =>
                              navigate(
                                `/trace/${
                                  order.listing.sourceBatch || order.listing.sourceIntakeId
                                }`
                              )
                            }
                            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition hidden sm:inline-flex items-center gap-1"
                          >
                            <span>🌱</span> Farm Passport
                          </button>
                        )}

                        {/* Official Invoice Button */}
                        <button
                          onClick={() => openInvoiceModal(order)}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg transition flex items-center gap-1 shadow-2xs"
                          title="View and Print Official Tax Invoice"
                        >
                          <span>🧾</span> Invoice
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Quick Cancel */}
                        {canCancel && (
                          <button
                            onClick={() => openOrderTracking(order)}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition"
                          >
                            Cancel
                          </button>
                        )}

                        {/* Quick Return */}
                        {isDelivered && (!order.refundStatus || order.refundStatus === 'NotRequired') && (
                          <button
                            onClick={() => openOrderTracking(order)}
                            className="px-3 py-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 hover:bg-amber-50 border border-amber-200 rounded-lg transition"
                          >
                            Return / Refund
                          </button>
                        )}

                        {/* Rate & Review Produce */}
                        {isDelivered && (
                          <button
                            onClick={() =>
                              openReviewModal(
                                'Listing',
                                order.listing?._id || order.listing,
                                order.listing?.produceType || 'FPO Produce',
                                order.listing?.images?.[0] || '',
                                order.gradeOrdered || order.listing?.grade || 'A'
                              )
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition flex items-center gap-1"
                          >
                            <span>⭐</span> Rate
                          </button>
                        )}

                        {/* 1-Click Reorder */}
                        <button
                          onClick={() => handleReorderItem(order)}
                          className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition flex items-center gap-1"
                        >
                          <span>🔁</span> Reorder
                        </button>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
            </div>
          </div>
        )}

        {/* ==================== RECURRING SUBSCRIPTIONS ==================== */}
        {tab === 'subscriptions' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">My Farm Box Subscriptions</h2>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full">
                    5% OFF APPLIED
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Manage recurring farm-to-door deliveries, pause, skip, or modify schedule
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                {subscriptions.filter((s) => s.status === 'Active').length} Active
              </span>
            </div>

            <div className="space-y-4">
              {subscriptions.length === 0 && (
                <div className="text-center py-14 border-2 border-dashed rounded-xl bg-emerald-50/20">
                  <span className="text-4xl block mb-2">🔁</span>
                  <h3 className="font-bold text-gray-800 text-base">No active recurring subscriptions</h3>
                  <p className="text-gray-500 text-xs mt-1 max-w-md mx-auto">
                    Subscribe to your favorite daily fresh produce and enjoy automatic 5% discounts with doorstep deliveries on your chosen day!
                  </p>
                  <button
                    onClick={() => setTab('fpoMarket')}
                    className="mt-4 inline-flex items-center text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-4 py-2 rounded-xl transition shadow-sm"
                  >
                    Browse Market & Subscribe →
                  </button>
                </div>
              )}

              {subscriptions.map((sub) => {
                const isPaused = sub.status === 'Paused';
                const isCancelled = sub.status === 'Cancelled';
                const isActive = sub.status === 'Active';

                const nextDateFormatted = new Date(sub.nextDeliveryDate).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={sub._id}
                    className={`border rounded-xl p-5 transition shadow-sm ${
                      isPaused
                        ? 'bg-amber-50/30 border-amber-200'
                        : isCancelled
                        ? 'bg-gray-50 border-gray-200 opacity-70'
                        : 'bg-white border-emerald-200/80 hover:border-emerald-400'
                    }`}
                  >
                    {/* Top Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔁</span>
                        <span className="text-xs font-bold text-gray-800">
                          {sub.frequency === 'Weekly'
                            ? 'Every Week'
                            : sub.frequency === 'BiWeekly'
                            ? 'Every 2 Weeks'
                            : 'Monthly'}{' '}
                          on {sub.deliveryDay}s
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">
                          5% Saved
                        </span>
                      </div>

                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPaused
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    {/* Middle Info Row */}
                    <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-base">{sub.produceName}</h3>
                          {sub.grade && (
                            <span className="text-[10px] font-semibold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                              Grade {sub.grade}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Delivery: <span className="font-medium text-gray-800">{sub.quantityKg} kg</span> per cycle
                          · Window: <span className="font-medium text-gray-700">{sub.deliverySlot}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Address: {sub.deliveryAddress?.streetAddress}, {sub.deliveryAddress?.city}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-base font-extrabold text-emerald-800">
                          ₹{sub.finalPricePerDelivery}
                          <span className="text-[11px] font-normal text-gray-500"> / delivery</span>
                        </p>
                        <p className="text-[11px] text-gray-400">
                          (Regular: ₹{sub.basePrice}) · via {sub.paymentMethod}
                        </p>
                      </div>
                    </div>

                    {/* Next Delivery Banner */}
                    {!isCancelled && (
                      <div className="mb-4 p-3 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-gray-700">
                          <span>🗓️</span>
                          <span>
                            <strong>Next Scheduled Delivery:</strong>{' '}
                            {isPaused ? 'Paused — Resume to restart' : nextDateFormatted}
                          </span>
                        </div>
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => handleSkipSubDelivery(sub._id)}
                            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                          >
                            Skip this delivery →
                          </button>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-gray-400">
                        {sub.deliveriesCompleted} deliveries completed
                      </p>

                      <div className="flex items-center gap-2">
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => handleToggleSubStatus(sub._id, sub.status)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                              isPaused
                                ? 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {isPaused ? '▶ Resume Subscription' : '⏸ Pause Subscription'}
                          </button>
                        )}

                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => handleCancelSub(sub._id)}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== WISHLIST ==================== */}
        {tab === 'wishlist' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>❤️</span> Saved Produce & Wishlist ({wishlist.length})
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Items you have bookmarked for quick ordering from FPOs
                </p>
              </div>
            </div>

            {wishlist.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-xl bg-gray-50/50">
                <span className="text-5xl block mb-2">🧺</span>
                <p className="font-semibold text-gray-700 text-sm">Your wishlist is empty</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto mb-4">
                  Tap the heart icon on any produce listing to bookmark it here for later.
                </p>
                <button
                  onClick={() => setTab('fpoMarket')}
                  className="bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-emerald-800 transition"
                >
                  Explore Produce
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {wishlist.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition bg-white flex flex-col justify-between"
                  >
                    <div className="h-32 bg-emerald-50 relative flex items-center justify-center overflow-hidden">
                      {item.grade && (
                        <span
                          className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded ${
                            gradeColors[item.grade] || 'bg-gray-600 text-white'
                          }`}
                        >
                          Grade {item.grade}
                        </span>
                      )}
                      <button
                        onClick={() => toggleWishlist(item)}
                        title="Remove from wishlist"
                        className="absolute top-2 right-2 w-7 h-7 bg-white/90 hover:bg-white rounded-full flex items-center justify-center text-xs shadow-sm"
                      >
                        ❤️
                      </button>
                      {item.imageUrl ? (
                        <img
                          src={
                            item.imageUrl.startsWith('http')
                              ? item.imageUrl
                              : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
                                  .replace('/api', '')}/${item.imageUrl.replace(/^.*uploads/, 'uploads')}`
                          }
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">🌾</span>
                      )}
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{item.name}</h4>
                        <p className="text-xs text-gray-500">By {item.seller}</p>
                        <p className="text-emerald-800 font-bold mt-1 text-sm">
                          ₹{item.pricePerKg} <span className="text-xs font-normal text-gray-500">/kg</span>
                        </p>
                      </div>

                      <div className="pt-3 mt-3 border-t flex gap-2">
                        <button
                          onClick={() => {
                            addToCart(item, item.minOrderQtyKg || 1);
                          }}
                          className="flex-1 bg-emerald-700 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-800 transition flex items-center justify-center gap-1"
                        >
                          <span>🛒</span> Move to Cart
                        </button>
                        <button
                          onClick={() => toggleWishlist(item)}
                          className="px-2.5 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== MY ACCOUNT ==================== */}
        {tab === 'account' && (
          <div className="space-y-6">
            {/* Top row: Profile & Security */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Profile Details Card */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>👤</span> Personal Profile
                  </h2>
                  <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {user?.role || 'Consumer'}
                  </span>
                </div>

                {profileMsg.text && (
                  <div
                    className={`mb-4 p-3 rounded-lg text-sm ${
                      profileMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {profileMsg.text}
                  </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Email Address (Permanent)
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full border border-gray-200 bg-gray-50 text-gray-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Primary Location / City
                    </label>
                    <input
                      type="text"
                      value={profileData.location}
                      onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                      required
                      placeholder="e.g. Delhi, Punjab"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="w-full bg-emerald-700 text-white font-medium py-2.5 rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition text-sm"
                  >
                    {profileSaving ? 'Saving Changes...' : 'Update Profile'}
                  </button>
                </form>
              </div>

              {/* Password / Security Card */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>🔒</span> Password & Security
                </h2>

                {passwordMsg.text && (
                  <div
                    className={`mb-4 p-3 rounded-lg text-sm ${
                      passwordMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {passwordMsg.text}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                      }
                      required
                      placeholder="Enter current password"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      required
                      placeholder="At least 6 characters"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
                      required
                      placeholder="Re-enter new password"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="w-full bg-gray-800 text-white font-medium py-2.5 rounded-lg hover:bg-gray-900 disabled:opacity-60 transition text-sm"
                  >
                    {passwordSaving ? 'Updating Password...' : 'Change Password'}
                  </button>
                </form>
              </div>
            </div>

            {/* Saved Addresses Book */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>📍</span> Saved Delivery Addresses
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Manage your delivery locations for faster checkout on fresh produce orders
                  </p>
                </div>
                <button
                  onClick={openAddAddressModal}
                  className="inline-flex items-center gap-1.5 bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-800 transition self-start sm:self-auto"
                >
                  <span>+</span> Add New Address
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                  <span className="text-4xl block mb-2">🏠</span>
                  <p className="font-semibold text-gray-700 text-sm">No addresses saved yet</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto mb-4">
                    Add your home, office, or store address so you can place orders seamlessly.
                  </p>
                  <button
                    onClick={openAddAddressModal}
                    className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
                  >
                    Add Address Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr._id}
                      className={`relative rounded-xl border p-4 transition flex flex-col justify-between ${
                        addr.isDefault
                          ? 'border-emerald-500 bg-emerald-50/30 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {addr.label || 'Home'}
                          </span>
                          {addr.isDefault && (
                            <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                              ✓ Default
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm">{addr.fullName}</h4>
                        <p className="text-xs text-emerald-800 font-medium mt-0.5">📞 {addr.phone}</p>
                        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                          {addr.streetAddress}
                          {addr.landmark ? `, Near ${addr.landmark}` : ''}
                          <br />
                          {addr.city}, {addr.state} - <span className="font-semibold">{addr.pincode}</span>
                        </p>
                      </div>

                      <div className="pt-4 mt-3 border-t flex items-center justify-between text-xs">
                        {!addr.isDefault ? (
                          <button
                            onClick={() => handleSetDefaultAddress(addr._id)}
                            className="text-emerald-700 hover:underline font-semibold"
                          >
                            Set Default
                          </button>
                        ) : (
                          <span className="text-gray-400">Primary</span>
                        )}
                        <div className="flex gap-3">
                          <button
                            onClick={() => openEditAddressModal(addr)}
                            className="text-gray-600 hover:text-emerald-700 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAddress(addr._id)}
                            className="text-red-500 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Navigation to Orders */}
            <div className="bg-gradient-to-r from-emerald-700 to-teal-800 rounded-xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">Looking for your order history?</h3>
                <p className="text-emerald-100 text-xs mt-1">
                  Track your verified FPO bulk/retail shipments ({fpoOrders.length}).
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTab('fpoOrders')}
                  className="bg-white text-emerald-800 text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-50 transition"
                >
                  View FPO Orders
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Address Modal */}
      {addressModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingAddressId ? 'Edit Address' : 'Add New Delivery Address'}
              </h3>
              <button
                onClick={() => setAddressModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {addressMsg.text && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                {addressMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveAddress} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Address Label
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Home', 'Work', 'Other'].map((lbl) => (
                    <button
                      type="button"
                      key={lbl}
                      onClick={() => setAddressForm({ ...addressForm, label: lbl })}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                        addressForm.label === lbl
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Contact Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.fullName}
                    onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                    placeholder="Recipient's Name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Street Address / Flat / Building *
                </label>
                <textarea
                  required
                  rows="2"
                  value={addressForm.streetAddress}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, streetAddress: e.target.value })
                  }
                  placeholder="e.g. Flat 302, Green Valley Apartments, Near Market Road"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={addressForm.landmark}
                  onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                  placeholder="e.g. Opposite City Hospital"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    City / Town *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="City"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    placeholder="State"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.pincode}
                    onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                    placeholder="6 digits"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefaultCheckbox"
                  checked={addressForm.isDefault}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, isDefault: e.target.checked })
                  }
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                <label htmlFor="isDefaultCheckbox" className="text-xs text-gray-700 font-medium">
                  Set as default delivery address
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddressModalOpen(false)}
                  className="flex-1 border rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addressSaving}
                  className="flex-1 bg-emerald-700 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-800 disabled:opacity-60 transition"
                >
                  {addressSaving ? 'Saving...' : editingAddressId ? 'Update Address' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer />

      {/* Checkout Modal */}
      <CheckoutModal />

      {/* Order Tracking & Post-Purchase Modal */}
      <OrderTrackingModal
        order={trackingOrder}
        isOpen={isTrackingOpen}
        onClose={() => {
          setIsTrackingOpen(false);
          setTrackingOrder(null);
        }}
        onOrderUpdated={() => {
          fetchFpoOrders();
        }}
      />

      {/* Review Modal */}
      <ReviewModal
        isOpen={reviewModalState.isOpen}
        onClose={() =>
          setReviewModalState((prev) => ({ ...prev, isOpen: false }))
        }
        targetType={reviewModalState.targetType}
        targetId={reviewModalState.targetId}
        productName={reviewModalState.productName}
        productImage={reviewModalState.productImage}
        grade={reviewModalState.grade}
        onReviewSubmitted={() => {
          setSuccess('Review submitted successfully!');
          setTimeout(() => setSuccess(''), 3000);
        }}
      />

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={subscriptionModal.isOpen}
        onClose={() =>
          setSubscriptionModal((prev) => ({ ...prev, isOpen: false }))
        }
        item={subscriptionModal.item}
        itemType={subscriptionModal.itemType}
        onSubscribed={() => {
          setSuccess('Subscribed to recurring farm delivery! Check your Subscriptions tab.');
          fetchSubscriptions();
          setTimeout(() => setSuccess(''), 4000);
        }}
      />

      {/* Official Tax Invoice & Cash Memo Modal */}
      <InvoiceModal
        order={invoiceModalOrder}
        isOpen={isInvoiceOpen}
        onClose={() => {
          setIsInvoiceOpen(false);
          setInvoiceModalOrder(null);
        }}
      />

      {/* Digital Produce Traceability Scanner Modal */}
      <TraceabilityModal
        isOpen={isTraceOpen}
        onClose={() => setIsTraceOpen(false)}
      />

      {/* Customer Help & Support Center Modal */}
      <HelpSupportModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}