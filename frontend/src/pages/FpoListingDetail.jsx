import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function FpoListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyerType, setBuyerType] = useState('INDIVIDUAL');
  const [ordering, setOrdering] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        setLoading(true);
        const res = await API.get(`/listings/public/${id}`);
        setListing(res.data);
        setQuantity(res.data.minOrderQtyKg || 1);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load product details');
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id]);

  const handleOrder = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError('Enter a valid quantity');
      return;
    }
    if (qty < listing.minOrderQtyKg) {
      setError(`Minimum order quantity is ${listing.minOrderQtyKg}kg`);
      return;
    }
    if (qty > listing.availableQuantityKg) {
      setError(`Only ${listing.availableQuantityKg}kg available`);
      return;
    }

    try {
      setOrdering(true);
      setError('');
      await API.post('/fpo-orders', {
        listingId: listing._id,
        quantityKg: qty,
        buyerType,
      });
      setSuccess('Order placed successfully!');
      setTimeout(() => {
        navigate('/consumer-dashboard');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  const gradeColors = {
    A: 'bg-emerald-700 text-white',
    B: 'bg-amber-600 text-white',
    C: 'bg-orange-600 text-white',
    Custom: 'bg-slate-600 text-white',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-lime-50 to-emerald-100">
        <div className="text-emerald-700 font-medium">Loading product...</div>
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-lime-50 to-emerald-100 gap-4">
        <p className="text-red-600">{error}</p>
        <Link to="/consumer-dashboard" className="text-emerald-700 underline">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  const images = listing.images?.length ? listing.images : [];
  const batch = listing.sourceBatch;
  const fpo = listing.fpo;

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-50 via-emerald-50 to-teal-50">
      <header className="bg-white/90 backdrop-blur border-b sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🌾</span>
            <span className="font-bold text-emerald-800">FarmFresh</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <div className="bg-white rounded-2xl border overflow-hidden shadow-sm aspect-square flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
              {images.length > 0 ? (
                <img
                  src={
                    images[activeImage].startsWith('http')
                      ? images[activeImage]
                      : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
                          .replace('/api', '')}/${images[activeImage].replace(/^.*uploads/, 'uploads')}`
                  }
                  alt={listing.produceType}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-8xl">🌾</span>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                      activeImage === idx ? 'border-emerald-600' : 'border-transparent'
                    }`}
                  >
                    <img
                      src={
                        img.startsWith('http')
                          ? img
                          : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
                              .replace('/api', '')}/${img.replace(/^.*uploads/, 'uploads')}`
                      }
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details + Order */}
          <div className="space-y-5">
            <div>
              <div className="flex items-start gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  {listing.produceType}
                </h1>
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    gradeColors[listing.grade] || 'bg-slate-600 text-white'
                  }`}
                >
                  Grade {listing.grade}
                </span>
              </div>
              <p className="text-gray-500 mt-1">
                Sold by <span className="font-medium text-emerald-800">{fpo?.name}</span>
              </p>
            </div>

            <div className="bg-white rounded-xl border p-4">
              <p className="text-3xl font-bold text-emerald-700">
                ₹{listing.pricePerKg}
                <span className="text-base font-normal text-gray-500"> / kg</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {listing.availableQuantityKg} kg available · Minimum order {listing.minOrderQtyKg} kg
              </p>
            </div>

            {listing.description && (
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Description</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{listing.description}</p>
              </div>
            )}

            <div className="bg-white rounded-xl border p-5 space-y-4 shadow-sm">
              <h3 className="font-semibold text-gray-800">Place Order</h3>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Ordering as</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'INDIVIDUAL', label: 'Individual' },
                    { value: 'KIRANA', label: 'Kirana' },
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

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Quantity (kg)</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min={listing.minOrderQtyKg}
                  max={listing.availableQuantityKg}
                  step={buyerType === 'INDIVIDUAL' ? 1 : 5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Estimated total</span>
                <span className="font-bold text-lg text-emerald-700">
                  ₹{(Number(quantity) * listing.pricePerKg || 0).toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleOrder}
                disabled={ordering || listing.availableQuantityKg === 0}
                className="w-full bg-emerald-700 text-white py-3 rounded-xl font-semibold hover:bg-emerald-800 disabled:bg-gray-300 transition"
              >
                {ordering
                  ? 'Placing Order...'
                  : listing.availableQuantityKg === 0
                  ? 'Out of Stock'
                  : 'Order Now'}
              </button>
            </div>
          </div>
        </div>

        {/* Extra Details */}
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-800 mb-3">About the FPO</h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-500">Name:</span>{' '}
                <span className="font-medium">{fpo?.name}</span>
              </p>
              {fpo?.registrationNumber && (
                <p>
                  <span className="text-gray-500">Registration:</span> {fpo.registrationNumber}
                </p>
              )}
              {(fpo?.contactDetails?.district || fpo?.contactDetails?.state) && (
                <p>
                  <span className="text-gray-500">Location:</span>{' '}
                  {[fpo.contactDetails?.district, fpo.contactDetails?.state]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              {fpo?.contactDetails?.phone && (
                <p>
                  <span className="text-gray-500">Contact:</span> {fpo.contactDetails.phone}
                </p>
              )}
            </div>
          </div>

          {batch && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Source & Traceability</h3>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-500">Batch ID:</span>{' '}
                  <span className="font-mono font-medium">{batch.batchId}</span>
                </p>
                {batch.farmer && (
                  <p>
                    <span className="text-gray-500">Farmer:</span> {batch.farmer.name}
                    {batch.farmer.village ? ` (${batch.farmer.village})` : ''}
                  </p>
                )}
                {batch.harvestDate && (
                  <p>
                    <span className="text-gray-500">Harvest Date:</span>{' '}
                    {new Date(batch.harvestDate).toLocaleDateString()}
                  </p>
                )}
                {batch.collectionDate && (
                  <p>
                    <span className="text-gray-500">Collected:</span>{' '}
                    {new Date(batch.collectionDate).toLocaleDateString()}
                  </p>
                )}
                {batch.grading?.qualityScore != null && (
                  <p>
                    <span className="text-gray-500">Quality Score:</span>{' '}
                    {batch.grading.qualityScore}/100
                  </p>
                )}
                {batch.pricingSnapshot?.referenceMarketPrice > 0 && (
                  <p>
                    <span className="text-gray-500">Reference Mandi Price:</span>{' '}
                    ₹{batch.pricingSnapshot.referenceMarketPrice}/kg
                  </p>
                )}
                {(batch.batchId || batch._id) && (
                  <Link
                    to={`/trace/${batch.batchId || batch._id}`}
                    className="inline-block mt-2 text-emerald-700 font-medium text-sm hover:underline"
                  >
                    View Full Traceability Passport →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}