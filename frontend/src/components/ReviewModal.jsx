import React, { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function ReviewModal({
  isOpen,
  onClose,
  targetType = 'Listing',
  targetId,
  productName = 'Produce',
  productImage = '',
  grade = '',
  onReviewSubmitted,
}) {
  const { user } = useAuth();

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [freshnessRating, setFreshnessRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  const [isVerifiedBuyer, setIsVerifiedBuyer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const ratingDescriptions = {
    1: 'Poor — Quality was unsatisfactory',
    2: 'Fair — Below expected freshness',
    3: 'Good — Fresh standard produce',
    4: 'Very Good — High quality & crisp',
    5: 'Exceptional — Farm-fresh & perfect',
  };

  useEffect(() => {
    if (!isOpen || !targetId || !user) return;

    const checkExistingReview = async () => {
      try {
        setError('');
        const res = await API.get(`/reviews/my-review/${targetType}/${targetId}`);
        if (res.data) {
          setIsVerifiedBuyer(res.data.isVerifiedBuyer);
          if (res.data.review) {
            setIsEditing(true);
            setRating(res.data.review.rating || 5);
            setFreshnessRating(res.data.review.freshnessRating || 5);
            setDeliveryRating(res.data.review.deliveryRating || 5);
            setTitle(res.data.review.title || '');
            setComment(res.data.review.comment || '');
          } else {
            setIsEditing(false);
            setRating(5);
            setFreshnessRating(5);
            setDeliveryRating(5);
            setTitle('');
            setComment('');
          }
        }
      } catch (err) {
        console.error('Failed to check user review status', err);
      }
    };

    checkExistingReview();
  }, [isOpen, targetId, targetType, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError('Please select a star rating.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const res = await API.post('/reviews', {
        targetType,
        targetId,
        rating,
        freshnessRating,
        deliveryRating,
        title,
        comment,
      });

      setSuccess(isEditing ? 'Review updated successfully!' : 'Thank you for reviewing!');
      if (onReviewSubmitted) {
        onReviewSubmitted(res.data.review);
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const resolvedImageUrl = productImage
    ? productImage.startsWith('http')
      ? productImage
      : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/${productImage.replace(/^.*uploads/, 'uploads')}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⭐</span>
            <div>
              <h2 className="text-base font-bold">
                {isEditing ? 'Edit Your Review' : 'Rate & Review Produce'}
              </h2>
              <p className="text-xs text-emerald-100">Help other consumers discover quality farm produce</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Product Info Mini Bar */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200/60">
            <div className="w-12 h-12 rounded-lg bg-emerald-100/50 flex items-center justify-center overflow-hidden flex-shrink-0 border">
              {resolvedImageUrl ? (
                <img src={resolvedImageUrl} alt={productName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">🌾</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-gray-900 text-sm truncate">{productName}</h4>
                {grade && (
                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    Grade {grade}
                  </span>
                )}
              </div>
              {isVerifiedBuyer ? (
                <p className="text-xs text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                  <span>✓</span> Verified Buyer
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-0.5">Community Review</p>
              )}
            </div>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <span>✅</span>
              <p>{success}</p>
            </div>
          )}

          {/* 1. Overall Rating */}
          <div className="text-center py-2 border-b pb-4">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Overall Experience
            </label>
            <div className="flex justify-center items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 text-3xl focus:outline-none transition-transform hover:scale-110 active:scale-95"
                  >
                    <span className={active ? 'text-amber-400 drop-shadow-sm' : 'text-gray-300'}>
                      ★
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-semibold text-emerald-800 mt-1 min-h-[1rem]">
              {ratingDescriptions[hoverRating || rating]}
            </p>
          </div>

          {/* 2. Quality Metrics: Freshness & Delivery */}
          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
              <label className="block text-xs font-bold text-emerald-900 mb-1.5 flex items-center gap-1">
                <span>🌱</span> Freshness
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFreshnessRating(s)}
                    className={`w-6 h-6 rounded-md text-xs font-bold transition ${
                      freshnessRating >= s
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Crispness & aroma</p>
            </div>

            <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100">
              <label className="block text-xs font-bold text-teal-900 mb-1.5 flex items-center gap-1">
                <span>📦</span> Packaging
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDeliveryRating(s)}
                    className={`w-6 h-6 rounded-md text-xs font-bold transition ${
                      deliveryRating >= s
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Condition & protection</p>
            </div>
          </div>

          {/* 3. Review Headline / Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Review Headline (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Crisp, sweet, and delivered right on time!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-lg p-2.5 outline-none focus:border-emerald-500 transition"
              maxLength={80}
            />
          </div>

          {/* 4. Review Comment */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Detailed Experience
            </label>
            <textarea
              rows="3"
              placeholder="Share how fresh the produce was, how it cooked, or what you liked most..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-lg p-2.5 outline-none focus:border-emerald-500 transition"
              maxLength={600}
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Submitting...' : isEditing ? 'Update Review' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
