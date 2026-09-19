import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'consumer',
    location: ''
  });
  const [fpoDetails, setFpoDetails] = useState({
    name: '',
    registrationType: '',
    registrationNumber: '',
    pan: '',
    gstin: '',
    state: '',
    district: '',
    pincode: '',
    address: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFpoChange = (e) => {
    setFpoDetails({ ...fpoDetails, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = formData.role === 'fpo_admin' ? { ...formData, fpoDetails } : formData;
      const res = await API.post('/auth/register', payload);
      login(res.data.user, res.data.token);

      // Route based on registered user role
      if (res.data.user.role === 'fpo_admin' || res.data.user.role === 'fpo_staff') {
        navigate('/fpo/dashboard');
      } else {
        navigate('/consumer-dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Decorative Banner */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 right-10 w-72 h-72 bg-yellow-300 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 -left-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="text-6xl mb-6">🌱</div>
          <h1 className="text-5xl font-extrabold leading-tight mb-4">Join FarmFresh</h1>
          <p className="text-xl text-green-50 max-w-md mb-10">
            Whether you run an FPO or cook with fresh produce, this is where FPOs and consumers meet.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg">🏢</div>
              <p className="text-green-50">FPOs digitize intakes, grading & stock</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg">🛒</div>
              <p className="text-green-50">Consumers buy fresh, at fair prices</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="text-4xl mb-2">🌱</div>
            <h1 className="text-2xl font-bold text-green-700">FarmFresh</h1>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h2>
          <p className="text-gray-500 mb-6">Start buying or managing produce in minutes</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">I am a</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'consumer' })}
                  className={formData.role === 'consumer' ? 'py-2 rounded-lg font-medium text-xs sm:text-sm border-2 border-green-600 bg-green-50 text-green-700 transition' : 'py-2 rounded-lg font-medium text-xs sm:text-sm border-2 border-gray-200 text-gray-500 transition'}
                >
                  Consumer
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'fpo_admin' })}
                  className={formData.role === 'fpo_admin' ? 'py-2 rounded-lg font-medium text-xs sm:text-sm border-2 border-green-600 bg-green-50 text-green-700 transition' : 'py-2 rounded-lg font-medium text-xs sm:text-sm border-2 border-gray-200 text-gray-500 transition'}
                >
                  FPO Admin
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-green-500"
                placeholder="Ramesh Kumar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-green-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-green-500"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-green-500"
                placeholder="Enter password"
              />
            </div>
            {formData.role === 'fpo_admin' && (
              <div className="border border-green-200 bg-green-50/40 rounded-xl p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Organisation details</h3>
                  <p className="text-xs text-gray-500">
                    Provide your FPO's official registration details. These are reviewed during KYC verification.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">FPO legal name *</label>
                  <input
                    type="text"
                    name="name"
                    value={fpoDetails.name}
                    onChange={handleFpoChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="As per registration certificate"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Registration type *</label>
                    <select
                      name="registrationType"
                      value={fpoDetails.registrationType}
                      onChange={handleFpoChange}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value="">Select</option>
                      <option value="Producer Company">Producer Company</option>
                      <option value="Cooperative Society">Cooperative Society</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Registration number *</label>
                    <input
                      type="text"
                      name="registrationNumber"
                      value={fpoDetails.registrationNumber}
                      onChange={handleFpoChange}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="CIN / society reg. no."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">PAN</label>
                    <input
                      type="text"
                      name="pan"
                      value={fpoDetails.pan}
                      onChange={handleFpoChange}
                      maxLength={10}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 uppercase"
                      placeholder="ABCDE1234F"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label>
                    <input
                      type="text"
                      name="gstin"
                      value={fpoDetails.gstin}
                      onChange={handleFpoChange}
                      maxLength={15}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 uppercase"
                      placeholder="15-character GSTIN"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">State *</label>
                    <input
                      type="text"
                      name="state"
                      value={fpoDetails.state}
                      onChange={handleFpoChange}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">District *</label>
                    <input
                      type="text"
                      name="district"
                      value={fpoDetails.district}
                      onChange={handleFpoChange}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Registered address</label>
                    <input
                      type="text"
                      name="address"
                      value={fpoDetails.address}
                      onChange={handleFpoChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
                    <input
                      type="text"
                      name="pincode"
                      value={fpoDetails.pincode}
                      onChange={handleFpoChange}
                      maxLength={6}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-green-500"
                placeholder="Delhi"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-60 mt-2"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-sm text-center text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-green-700 font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;