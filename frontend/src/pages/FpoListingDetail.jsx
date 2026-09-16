import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import CartDrawer from '../components/CartDrawer';
import CheckoutModal from '../components/CheckoutModal';
import ReviewModal from '../components/ReviewModal';
import SubscriptionModal from '../components/SubscriptionModal';

export default function FpoListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    addToCart,
    cartCount,
    toggleWishlist,
    isInWishlist,
    setIsCartOpen,
  } = useCart();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyerType, setBuyerType] = useState('INDIVIDUAL');
  const [ordering, setOrdering] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    averageFreshness: 0,
    averageDelivery: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [userVotedMap, setUserVotedMap] = useState({});

  const fetchReviews = async () => {
    try {
      const res = await API.get(`/reviews/item/Listing/${id}`);
      if (res.data) {
        setReviews(res.data.reviews || []);
        setReviewStats(res.data.stats || {
          totalReviews: 0,
          averageRating: 0,
          averageFreshness: 0,
          averageDelivery: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        });
      }
    } catch (err) {
      console.error('Failed to load reviews', err);
    }
  };

  const handleVoteHelpful = async (reviewId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const res = await API.post(`/reviews/${reviewId}/vote`);
      setReviews((prev) =>
        prev.map((r) =>
          r._id === reviewId ? { ...r, helpfulVotes: res.data.helpfulVotes } : r
        )
      );
      setUserVotedMap((prev) => ({ ...prev, [reviewId]: res.data.hasVoted }));
    } catch (err) {
      console.error('Failed to vote', err);
    }
  };

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
    fetchReviews();
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
          <div className="flex items-center gap-2">
            {listing && (
              <button
                onClick={() => toggleWishlist(listing)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-white text-rose-600 border-rose-200 hover:bg-rose-50 transition flex items-center gap-1 shadow-sm"
              >
                <span>{isInWishlist(listing._id) ? '❤️' : '🤍'}</span>
                <span className="hidden sm:inline">Wishlist</span>
              </button>
            )}
            <button
              onClick={() => setIsCartOpen(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800 transition flex items-center gap-1.5 shadow-sm"
            >
              <span>🛒</span>
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="bg-amber-400 text-gray-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                  {cartCount}kg
                </span>
              )}
            </button>
          </div>
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
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center text-amber-400 text-sm">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s}>
                      {s <= Math.round(reviewStats.averageRating || 5) ? '★' : '☆'}
                    </span>
                  ))}
                </div>
                <span className="text-xs font-bold text-gray-800">
                  {reviewStats.totalReviews > 0 ? `${reviewStats.averageRating} / 5` : 'New Listing'}
                </span>
                <span className="text-xs text-gray-400">·</span>
                <a
                  href="#customer-reviews"
                  className="text-xs text-emerald-700 hover:underline font-medium"
                >
                  {reviewStats.totalReviews}{' '}
                  {reviewStats.totalReviews === 1 ? 'review' : 'reviews'}
                </a>
              </div>
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

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const q = Number(quantity) || listing.minOrderQtyKg || 1;
                    addToCart(listing, q, buyerType);
                  }}
                  disabled={listing.availableQuantityKg === 0}
                  className="flex-1 border-2 border-emerald-700 text-emerald-800 py-3 rounded-xl font-bold hover:bg-emerald-50 disabled:opacity-40 transition text-sm flex items-center justify-center gap-1.5"
                >
                  <span>🛒</span> Add to Cart
                </button>
                <button
                  onClick={handleOrder}
                  disabled={ordering || listing.availableQuantityKg === 0}
                  className="flex-1 bg-emerald-700 text-white py-3 rounded-xl font-bold hover:bg-emerald-800 disabled:bg-gray-300 transition text-sm"
                >
                  {ordering
                    ? 'Placing Order...'
                    : listing.availableQuantityKg === 0
                    ? 'Out of Stock'
                    : 'Buy Now'}
                </button>
              </div>

              {/* Subscribe & Save Recurring Button */}
              <button
                type="button"
                onClick={() => setIsSubscriptionModalOpen(true)}
                disabled={listing.availableQuantityKg === 0}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white py-3 rounded-xl font-bold shadow-sm transition text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span>🔁</span> Subscribe & Save 5%
                <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-extrabold uppercase">
                  Recurring Delivery
                </span>
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

        {/* Customer Reviews & Farm Quality Section */}
        <div id="customer-reviews" className="mt-8 bg-white rounded-xl border p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>⭐</span> Customer Reviews & Farm Ratings
                </h3>
                <p className="text-xs text-gray-500">
                  Real feedback from verified buyers and community consumers
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                  } else {
                    setIsReviewModalOpen(true);
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 self-start sm:self-auto"
              >
                <span>✍️</span> Write a Review
              </button>
            </div>

            {/* Rating Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-gray-50/70 rounded-xl border border-gray-200/60">
              {/* Overall Score */}
              <div className="flex flex-col items-center justify-center text-center p-2 border-b md:border-b-0 md:border-r border-gray-200">
                <span className="text-4xl font-extrabold text-gray-900">
                  {reviewStats.totalReviews > 0 ? reviewStats.averageRating : '0.0'}
                </span>
                <div className="flex items-center text-amber-400 text-base my-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s}>
                      {s <= Math.round(reviewStats.averageRating || 0) ? '★' : '☆'}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  Based on {reviewStats.totalReviews}{' '}
                  {reviewStats.totalReviews === 1 ? 'review' : 'reviews'}
                </p>
              </div>

              {/* Star Breakdown Bars */}
              <div className="space-y-1.5 justify-center flex flex-col">
                {[5, 4, 3, 2, 1].map((starNum) => {
                  const count = reviewStats.distribution?.[starNum] || 0;
                  const pct =
                    reviewStats.totalReviews > 0
                      ? Math.round((count / reviewStats.totalReviews) * 100)
                      : 0;

                  return (
                    <div key={starNum} className="flex items-center gap-2 text-xs">
                      <span className="w-6 text-gray-600 font-medium flex items-center">
                        {starNum}★
                      </span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-gray-400 text-[11px]">{count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Quality Sub-Scores */}
              <div className="flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span className="flex items-center gap-1">
                      <span>🌱</span> Farm Freshness
                    </span>
                    <span className="text-emerald-700">
                      {reviewStats.averageFreshness > 0 ? `${reviewStats.averageFreshness} / 5` : '5.0 / 5'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{
                        width: `${((reviewStats.averageFreshness || 5) / 5) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span className="flex items-center gap-1">
                      <span>📦</span> Packaging & Delivery
                    </span>
                    <span className="text-teal-700">
                      {reviewStats.averageDelivery > 0 ? `${reviewStats.averageDelivery} / 5` : '5.0 / 5'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 rounded-full"
                      style={{
                        width: `${((reviewStats.averageDelivery || 5) / 5) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <span className="text-3xl block mb-2">🌿</span>
                  No reviews yet for this harvest. Be the first to share your experience!
                </div>
              ) : (
                reviews.map((rev) => (
                  <div key={rev._id} className="border-b last:border-0 pb-4 last:pb-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">
                            {rev.consumer?.name || 'Consumer'}
                          </span>
                          {rev.isVerifiedBuyer && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              <span>✓</span> Verified Buyer
                            </span>
                          )}
                        </div>
                        {rev.consumer?.location && (
                          <p className="text-[11px] text-gray-400">{rev.consumer.location}</p>
                        )}
                      </div>

                      <span className="text-xs text-gray-400">
                        {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-amber-400 text-xs">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s}>{s <= rev.rating ? '★' : '☆'}</span>
                        ))}
                      </div>
                      {rev.title && (
                        <h4 className="font-bold text-xs text-gray-800">{rev.title}</h4>
                      )}
                    </div>

                    {rev.comment && (
                      <p className="text-xs text-gray-600 leading-relaxed">{rev.comment}</p>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        {rev.freshnessRating && (
                          <span>Freshness: {rev.freshnessRating}★</span>
                        )}
                        {rev.deliveryRating && (
                          <span>Packaging: {rev.deliveryRating}★</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleVoteHelpful(rev._id)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition flex items-center gap-1 font-medium ${
                          userVotedMap[rev._id]
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span>👍</span> Helpful ({rev.helpfulVotes || 0})
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

      {/* Review Modal */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        targetType="Listing"
        targetId={listing._id}
        productName={listing.produceType}
        productImage={listing.images?.[0] || ''}
        grade={listing.grade}
        onReviewSubmitted={() => {
          fetchReviews();
        }}
      />

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        item={listing}
        itemType="FPO"
        onSubscribed={() => {
          setSuccess('Subscribed to recurring deliveries! Manage anytime in your dashboard.');
          setTimeout(() => setSuccess(''), 4000);
        }}
      />

      {/* Cart Drawer */}
      <CartDrawer />

      {/* Checkout Modal */}
      <CheckoutModal />
    </div>
  );
}