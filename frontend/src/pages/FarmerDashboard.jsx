import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function FarmerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('listings');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const emptyForm = { name: '', category: '', pricePerKg: '', quantityAvailable: '', location: user?.location || '' };
  const [formData, setFormData] = useState(emptyForm);

  const fetchListings = async () => {
    try {
      const res = await API.get('/produce/mine');
      setListings(res.data);
    } catch (err) {
      setError('Failed to load listings');
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await API.get('/orders/received');
      setOrders(res.data);
    } catch (err) {
      setError('Failed to load orders');
    }
  };

  useEffect(() => {
    fetchListings();
    fetchOrders();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setImageFile(null);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        await API.put('/produce/' + editingId, formData);
        setSuccess('Listing updated');
      } else {
        const form = new FormData();
        Object.keys(formData).forEach((key) => form.append(key, formData[key]));
        if (imageFile) form.append('image', imageFile);
        await API.post('/produce', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSuccess('Produce added');
      }
      resetForm();
      fetchListings();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const handleEdit = (item) => {
    setEditingId(item._id);
    setFormData({
      name: item.name,
      category: item.category,
      pricePerKg: item.pricePerKg,
      quantityAvailable: item.quantityAvailable,
      location: item.location
    });
    setTab('listings');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    try {
      await API.delete('/produce/' + id);
      fetchListings();
    } catch (err) {
      setError('Failed to delete listing');
    }
  };

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await API.put('/orders/' + orderId + '/status', { status });
      fetchOrders();
    } catch (err) {
      setError('Failed to update order');
    }
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
            <span className="text-2xl">🌾</span>
            <h1 className="text-xl font-bold text-gray-900">FarmFresh <span className="text-green-600 font-medium">/ Farmer</span></h1>
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
          <button onClick={() => setTab('listings')} className={tab === 'listings' ? 'px-5 py-2 rounded-md text-sm font-medium bg-green-600 text-white' : 'px-5 py-2 rounded-md text-sm font-medium text-gray-600'}>
            My Listings
          </button>
          <button onClick={() => setTab('orders')} className={tab === 'orders' ? 'px-5 py-2 rounded-md text-sm font-medium bg-green-600 text-white' : 'px-5 py-2 rounded-md text-sm font-medium text-gray-600'}>
            Incoming Orders {orders.length > 0 && '(' + orders.length + ')'}
          </button>
        </div>

        {tab === 'listings' && (
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6 h-fit">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editingId ? 'Edit Produce' : 'Add New Produce'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="text" name="name" placeholder="Produce Name" value={formData.name} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500" />
                <input type="text" name="category" placeholder="Category" value={formData.category} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" name="pricePerKg" placeholder="Price/kg" value={formData.pricePerKg} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500" />
                  <input type="number" name="quantityAvailable" placeholder="Qty (kg)" value={formData.quantityAvailable} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500" />
                </div>
                <input type="text" name="location" placeholder="Location" value={formData.location} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500" />
                {!editingId && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Photo (optional)</label>
                    <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="w-full text-sm" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition">
                    {editingId ? 'Save Changes' : 'Add Produce'}
                  </button>
                  {editingId && (
                    <button type="button" onClick={resetForm} className="px-4 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="lg:col-span-3">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">My Listings ({listings.length})</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {listings.length === 0 && <p className="text-gray-400 text-sm">No listings yet — add your first one.</p>}
                {listings.map((item) => (
                  <div key={item._id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="h-32 bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl.startsWith('http') ? item.imageUrl : 'https://farmfresh-backend-j2n4.onrender.com' + item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">🥬</span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500 mb-2">{item.category}</p>
                      <p className="text-green-700 font-bold">₹{item.pricePerKg}<span className="text-xs font-normal text-gray-500">/kg</span></p>
                      <p className="text-xs text-gray-500 mb-3">{item.quantityAvailable}kg available</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(item)} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-md">Edit</button>
                        <button onClick={() => handleDelete(item._id)} className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded-md">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Incoming Orders</h2>
            <div className="space-y-3">
              {orders.length === 0 && <p className="text-gray-400 text-sm">No orders yet.</p>}
              {orders.map((order) => (
                <div key={order._id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">{order.produceId?.name} — {order.quantity}kg</p>
                    <p className="text-sm text-gray-500">From: {order.consumerId?.name} ({order.consumerId?.location})</p>
                    <p className="text-sm text-gray-500">Total: ₹{order.totalPrice}</p>
                    <span className={'inline-block mt-2 text-xs px-2 py-1 rounded-full font-medium ' + statusColor[order.status]}>
                      {order.status}
                    </span>
                  </div>
                  <select value={order.status} onChange={(e) => handleStatusUpdate(order._id, e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="placed">Placed</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FarmerDashboard;