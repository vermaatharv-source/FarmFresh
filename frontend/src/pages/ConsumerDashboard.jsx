import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function ConsumerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Original farmer-direct marketplace
  const [produce, setProduce] = useState([]);
  const [orders, setOrders] = useState([]);
  const [quantities, setQuantities] = useState({});

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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Payment modal (kept for original produce flow)
  const [paymentModal, setPaymentModal] = useState(null);
  const [cardData, setCardData] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [paymentError, setPaymentError] = useState('');

  // ---------- Fetchers ----------
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

  const fetchProduce = async () => {
    try {
      const res = await API.get('/produce');
      setProduce(res.data);
    } catch (err) {
      setError('Failed to load produce');
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await API.get('/orders/mine');
      setOrders(res.data);
    } catch (err) {
      setError('Failed to load orders');
    }
  };

  useEffect(() => {
    fetchProduce();
    fetchOrders();
    fetchFpoOrders();
  }, []);

  useEffect(() => {
    fetchFpoListings();
  }, [fetchFpoListings]);

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

  const handleQuantityChange = (produceId, value) => {
    setQuantities({ ...quantities, [produceId]: value });
  };

  const openPaymentModal = (item) => {
    const quantity = Number(quantities[item._id]);
    if (!quantity || quantity <= 0) {
      setError('Enter a valid quantity');
      return;
    }
    setError('');
    setPaymentError('');
    setCardData({ number: '', expiry: '', cvv: '', name: '' });
    setPaymentStatus('idle');
    setPaymentModal({
      produceId: item._id,
      quantity,
      totalPrice: quantity * item.pricePerKg,
      name: item.name,
    });
  };

  const closeModal = () => {
    setPaymentModal(null);
    setPaymentStatus('idle');
  };

  const handleCardChange = (e) => {
    let { name, value } = e.target;
    if (name === 'number') {
      value = value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    }
    if (name === 'expiry') {
      value = value.replace(/\D/g, '').slice(0, 4);
      if (value.length >= 3) value = value.slice(0, 2) + '/' + value.slice(2);
    }
    if (name === 'cvv') {
      value = value.replace(/\D/g, '').slice(0, 3);
    }
    setCardData({ ...cardData, [name]: value });
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setPaymentError('');

    const digitsOnly = cardData.number.replace(/\s/g, '');
    if (digitsOnly.length !== 16) {
      setPaymentError('Enter a valid 16-digit card number');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(cardData.expiry)) {
      setPaymentError('Enter a valid expiry (MM/YY)');
      return;
    }
    if (cardData.cvv.length !== 3) {
      setPaymentError('Enter a valid 3-digit CVV');
      return;
    }
    if (!cardData.name.trim()) {
      setPaymentError('Enter the name on card');
      return;
    }

    setPaymentStatus('processing');

    setTimeout(async () => {
      try {
        await API.post('/orders', {
          produceId: paymentModal.produceId,
          quantity: paymentModal.quantity,
        });
        setPaymentStatus('success');
        setQuantities({ ...quantities, [paymentModal.produceId]: '' });
        fetchProduce();
        fetchOrders();

        setTimeout(() => {
          closeModal();
          setSuccess('Payment successful — order placed!');
        }, 1200);
      } catch (err) {
        setPaymentStatus('idle');
        setPaymentError(err.response?.data?.message || 'Payment failed — please try again');
      }
    }, 2000);
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
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">Hi, {user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm bg-emerald-700 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-800 transition"
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
            { id: 'browse', label: 'Farmer Direct' },
            { id: 'orders', label: 'Direct Orders' },
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

                    <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        placeholder="kg"
                        value={fpoQuantities[item._id] || ''}
                        onChange={(e) =>
                          setFpoQuantities({ ...fpoQuantities, [item._id]: e.target.value })
                        }
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
                        min={item.minOrderQtyKg}
                        max={item.availableQuantityKg}
                        step={buyerType === 'INDIVIDUAL' ? 1 : 5}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaceFpoOrder(item);
                        }}
                        disabled={item.availableQuantityKg === 0}
                        className="flex-1 bg-emerald-700 text-white text-sm py-1.5 rounded-lg hover:bg-emerald-800 disabled:bg-gray-300 transition font-medium"
                      >
                        {item.availableQuantityKg === 0 ? 'Out of Stock' : 'Order'}
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My FPO Orders</h2>
            <div className="space-y-3">
              {fpoOrders.length === 0 && (
                <p className="text-gray-400 text-sm">No FPO orders yet.</p>
              )}
              {fpoOrders.map((order) => (
                <div
                  key={order._id}
                  className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {order.listing?.produceType} — {order.quantityKg}kg
                      <span className="ml-2 text-xs font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Grade {order.gradeOrdered || order.listing?.grade}
                      </span>
                    </p>
                    <p className="text-sm text-gray-500">
                      From: {order.fpo?.name} · Buyer type: {order.buyerType}
                    </p>
                    <p className="text-sm text-gray-500">Total: ₹{order.totalPrice}</p>
                  </div>
                  <span
                    className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${
                      statusColor[order.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== ORIGINAL FARMER DIRECT ==================== */}
        {tab === 'browse' && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {produce.length === 0 && (
              <p className="text-gray-500 text-sm">No produce available right now.</p>
            )}
            {produce.map((item) => (
              <div
                key={item._id}
                className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition"
              >
                <div className="h-36 bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center overflow-hidden relative">
                  {item.isTrending && (
                    <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full z-10">
                      🔥 Trending
                    </span>
                  )}
                  {item.imageUrl ? (
                    <img
                      src={
                        item.imageUrl.startsWith('http')
                          ? item.imageUrl
                          : `https://farmfresh-backend-j2n4.onrender.com${item.imageUrl}`
                      }
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl">🥬</span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-xs text-gray-500">{item.category}</p>
                  <p className="text-green-700 font-bold mt-1">
                    ₹{item.pricePerKg}
                    <span className="text-xs font-normal text-gray-500">/kg</span>
                  </p>
                  <p className="text-xs text-gray-500 mb-1">{item.quantityAvailable}kg available</p>
                  <p className="text-xs text-gray-400 mb-3">
                    By {item.farmerId?.name} · {item.farmerId?.location}
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="kg"
                      value={quantities[item._id] || ''}
                      onChange={(e) => handleQuantityChange(item._id, e.target.value)}
                      className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-500"
                      min="1"
                    />
                    <button
                      onClick={() => openPaymentModal(item)}
                      className="flex-1 bg-green-600 text-white text-sm py-1.5 rounded-lg hover:bg-green-700 transition"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ==================== DIRECT ORDERS ==================== */}
        {tab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Direct Orders</h2>
            <div className="space-y-3">
              {orders.length === 0 && <p className="text-gray-400 text-sm">No orders yet.</p>}
              {orders.map((order) => (
                <div key={order._id} className="border rounded-lg p-4">
                  <p className="font-semibold text-gray-900">
                    {order.produceId?.name} — {order.quantity}kg
                  </p>
                  <p className="text-sm text-gray-500">
                    From: {order.farmerId?.name} ({order.farmerId?.location})
                  </p>
                  <p className="text-sm text-gray-500">Total: ₹{order.totalPrice}</p>
                  <span
                    className={`inline-block mt-2 text-xs px-2 py-1 rounded-full font-medium ${
                      statusColor[order.status]
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            {paymentStatus === 'success' ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-xl font-bold text-green-700">Payment Successful!</h3>
                <p className="text-gray-500 mt-1">Your order has been placed.</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Complete Payment</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {paymentModal.name} · {paymentModal.quantity}kg · ₹{paymentModal.totalPrice}
                </p>

                <form onSubmit={handlePaySubmit} className="space-y-3">
                  <input
                    name="name"
                    placeholder="Name on card"
                    value={cardData.name}
                    onChange={handleCardChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    required
                  />
                  <input
                    name="number"
                    placeholder="Card number"
                    value={cardData.number}
                    onChange={handleCardChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    required
                  />
                  <div className="flex gap-3">
                    <input
                      name="expiry"
                      placeholder="MM/YY"
                      value={cardData.expiry}
                      onChange={handleCardChange}
                      className="w-1/2 border rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      required
                    />
                    <input
                      name="cvv"
                      placeholder="CVV"
                      value={cardData.cvv}
                      onChange={handleCardChange}
                      className="w-1/2 border rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  {paymentError && <p className="text-red-600 text-sm">{paymentError}</p>}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={paymentStatus === 'processing'}
                      className="flex-1 bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-800 disabled:opacity-60"
                    >
                      {paymentStatus === 'processing' ? 'Processing...' : `Pay ₹${paymentModal.totalPrice}`}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}