import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function ConsumerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [produce, setProduce] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('browse');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [quantities, setQuantities] = useState({});

  const [paymentModal, setPaymentModal] = useState(null); // holds { produceId, quantity, totalPrice, name }
  const [cardData, setCardData] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle | processing | success
  const [paymentError, setPaymentError] = useState('');

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
  }, []);

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
      name: item.name
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
          quantity: paymentModal.quantity
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

  const statusColor = { placed: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800', delivered: 'bg-green-100 text-green-800' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-100 via-emerald-50 to-teal-100 relative overflow-hidden">
      <div className="absolute inset-0 opacity-60 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(21 128 61 / 0.25) 1.5px, transparent 0)',
        backgroundSize: '28px 28px'
      }}></div>
      <div className="absolute -top-32 -right-32 w-[30rem] h-[30rem] bg-yellow-300 rounded-full blur-3xl opacity-40 pointer-events-none"></div>
      <div className="absolute top-1/3 -left-32 w-[28rem] h-[28rem] bg-teal-300 rounded-full blur-3xl opacity-40 pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-400 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
      <div className="absolute top-10 left-1/3 w-72 h-72 bg-emerald-300 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            <h1 className="text-xl font-bold text-gray-900">FarmFresh <span className="text-green-600 font-medium">/ Consumer</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm">Hi, {user?.name}</span>
            <button onClick={handleLogout} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 relative z-10">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg mb-4 text-sm">{success}</div>}

        <div className="flex gap-2 mb-6 bg-white p-1 rounded-lg inline-flex border">
          <button onClick={() => setTab('browse')} className={tab === 'browse' ? 'px-5 py-2 rounded-md text-sm font-medium bg-green-600 text-white' : 'px-5 py-2 rounded-md text-sm font-medium text-gray-600'}>
            Browse Produce
          </button>
          <button onClick={() => setTab('orders')} className={tab === 'orders' ? 'px-5 py-2 rounded-md text-sm font-medium bg-green-600 text-white' : 'px-5 py-2 rounded-md text-sm font-medium text-gray-600'}>
            My Orders {orders.length > 0 && '(' + orders.length + ')'}
          </button>
        </div>

        {tab === 'browse' && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {produce.length === 0 && <p className="text-gray-500 text-sm">No produce available right now.</p>}
            {produce.map((item) => (
              <div key={item._id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition">
                <div className="h-36 bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center overflow-hidden relative">
                  {item.isTrending && (
                    <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full z-10">
                      🔥 Trending
                    </span>
                  )}
                  {item.imageUrl ? (
                    <img src={'http://localhost:5000' + item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl">🥬</span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-xs text-gray-500">{item.category}</p>
                  <p className="text-green-700 font-bold mt-1">₹{item.pricePerKg}<span className="text-xs font-normal text-gray-500">/kg</span></p>
                  <p className="text-xs text-gray-500 mb-1">{item.quantityAvailable}kg available</p>
                  <p className="text-xs text-gray-400 mb-3">By {item.farmerId?.name} · {item.farmerId?.location}</p>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="kg"
                      value={quantities[item._id] || ''}
                      onChange={(e) => handleQuantityChange(item._id, e.target.value)}
                      className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-500"
                      min="1"
                      max={item.quantityAvailable}
                    />
                    <button
                      onClick={() => openPaymentModal(item)}
                      disabled={item.quantityAvailable === 0}
                      className="flex-1 bg-green-600 text-white text-sm py-1.5 rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition"
                    >
                      {item.quantityAvailable === 0 ? 'Out of Stock' : 'Order'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Orders</h2>
            <div className="space-y-3">
              {orders.length === 0 && <p className="text-gray-400 text-sm">No orders yet.</p>}
              {orders.map((order) => (
                <div key={order._id} className="border rounded-lg p-4">
                  <p className="font-semibold text-gray-900">{order.produceId?.name} — {order.quantity}kg</p>
                  <p className="text-sm text-gray-500">From: {order.farmerId?.name} ({order.farmerId?.location})</p>
                  <p className="text-sm text-gray-500">Total: ₹{order.totalPrice}</p>
                  <span className={'inline-block mt-2 text-xs px-2 py-1 rounded-full font-medium ' + statusColor[order.status]}>
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
            {paymentStatus !== 'processing' && paymentStatus !== 'success' && (
              <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">×</button>
            )}

            {paymentStatus === 'success' ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-lg font-semibold text-gray-900">Payment Successful</h3>
                <p className="text-sm text-gray-500 mt-1">Your order has been placed</p>
              </div>
            ) : paymentStatus === 'processing' ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-700 font-medium">Processing Payment...</p>
                <p className="text-xs text-gray-400 mt-1">Do not close this window</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Secure Payment</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {paymentModal.name} · {paymentModal.quantity}kg · <span className="font-semibold text-green-700">₹{paymentModal.totalPrice}</span>
                </p>

                {paymentError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-3 text-xs">
                    {paymentError}
                  </div>
                )}

                <form onSubmit={handlePaySubmit} className="space-y-3">
                  <input
                    type="text"
                    name="name"
                    placeholder="Name on card"
                    value={cardData.name}
                    onChange={handleCardChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500"
                  />
                  <input
                    type="text"
                    name="number"
                    placeholder="1234 5678 9012 3456"
                    value={cardData.number}
                    onChange={handleCardChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500"
                  />
                  <div className="flex gap-3">
                    <input
                      type="text"
                      name="expiry"
                      placeholder="MM/YY"
                      value={cardData.expiry}
                      onChange={handleCardChange}
                      className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500"
                    />
                    <input
                      type="text"
                      name="cvv"
                      placeholder="CVV"
                      value={cardData.cvv}
                      onChange={handleCardChange}
                      className="w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition"
                  >
                    Pay ₹{paymentModal.totalPrice}
                  </button>
                  <p className="text-[11px] text-gray-400 text-center">🔒 Test mode — no real payment is processed</p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConsumerDashboard;