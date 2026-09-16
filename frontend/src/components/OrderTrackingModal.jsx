import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useCart } from '../context/CartContext';
import ReviewModal from './ReviewModal';
import InvoiceModal from './InvoiceModal';

export default function OrderTrackingModal({ order, isOpen, onClose, onOrderUpdated }) {
  const navigate = useNavigate();
  const { addToCart, setIsCartOpen } = useCart();

  const [currentOrder, setCurrentOrder] = useState(order);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [showCancelSection, setShowCancelSection] = useState(false);
  const [cancelReason, setCancelReason] = useState('Ordered by mistake');
  const [cancelNotes, setCancelNotes] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [showReturnSection, setShowReturnSection] = useState(false);
  const [returnReason, setReturnReason] = useState('Damaged or spoiled produce');
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Keep internal state synchronized with prop
  React.useEffect(() => {
    setCurrentOrder(order);
    setShowCancelSection(false);
    setShowReturnSection(false);
    setActionSuccess('');
    setActionError('');
  }, [order]);

  if (!isOpen || !currentOrder) return null;

  const isFpo = Boolean(currentOrder.listing || currentOrder.fpo);
  const orderId = currentOrder._id;
  const status = currentOrder.status || 'Placed';
  const statusLower = status.toLowerCase();

  // Normalize produce item information
  const itemName = isFpo
    ? (currentOrder.listing?.produceType || 'FPO Produce')
    : (currentOrder.produceId?.name || 'Farm Direct Produce');
  const itemGrade = isFpo
    ? (currentOrder.gradeOrdered || currentOrder.listing?.grade || 'A')
    : (currentOrder.produceId?.category || 'Direct');
  const itemQty = isFpo ? (currentOrder.quantityKg || 0) : (currentOrder.quantity || 0);
  const itemPrice = currentOrder.totalPrice || 0;
  const sellerName = isFpo
    ? (currentOrder.fpo?.name || 'Partner FPO')
    : (currentOrder.farmerId?.name || 'Local Farmer');
  const sellerLocation = !isFpo && currentOrder.farmerId?.location ? currentOrder.farmerId.location : '';

  const imageUrl = isFpo
    ? currentOrder.listing?.images?.[0]
    : currentOrder.produceId?.imageUrl;
  const resolvedImageUrl = imageUrl
    ? (imageUrl.startsWith('http')
        ? imageUrl
        : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/${imageUrl.replace(/^.*uploads/, 'uploads')}`)
    : null;

  // Stepper definition
  const fpoStages = [
    { key: 'Placed', label: 'Order Placed', desc: 'Received & logged in farm ledger' },
    { key: 'Accepted', label: 'Order Accepted', desc: 'Confirmed by FPO warehouse' },
    { key: 'Packed', label: 'Quality & Packed', desc: 'Graded & packed in cold chain' },
    { key: 'Dispatched', label: 'Out for Delivery', desc: 'Dispatched with delivery partner' },
    { key: 'Delivered', label: 'Delivered', desc: 'Safely delivered to your address' },
  ];

  const directStages = [
    { key: 'placed', label: 'Order Placed', desc: 'Sent to farmer' },
    { key: 'confirmed', label: 'Farmer Confirmed', desc: 'Farmer confirmed harvest' },
    { key: 'delivered', label: 'Delivered', desc: 'Delivered to consumer' },
  ];

  const stages = isFpo ? fpoStages : directStages;

  // Current active step index
  const isCancelled = ['cancelled', 'rejected'].includes(statusLower);
  const isRefunded = statusLower === 'refunded';

  const currentStepIndex = stages.findIndex((s) => s.key.toLowerCase() === statusLower);

  // Cancellation eligibility
  const canCancel = isFpo
    ? ['placed', 'accepted'].includes(statusLower)
    : ['placed', 'confirmed'].includes(statusLower);

  // Return eligibility: only delivered, not already pending/processed refund
  const canReturn =
    statusLower === 'delivered' &&
    (!currentOrder.refundStatus || currentOrder.refundStatus === 'NotRequired');

  // Handle Cancel
  const handleConfirmCancel = async () => {
    setCancelling(true);
    setActionError('');
    setActionSuccess('');
    try {
      const fullReason = cancelNotes.trim()
        ? `${cancelReason} - ${cancelNotes.trim()}`
        : cancelReason;

      let res;
      if (isFpo) {
        res = await API.put(`/fpo-orders/${orderId}/consumer-cancel`, { reason: fullReason });
      } else {
        res = await API.put(`/orders/${orderId}/cancel`, { reason: fullReason });
      }

      const updated = res.data.order || res.data;
      setCurrentOrder(updated);
      setShowCancelSection(false);
      setActionSuccess('Order has been cancelled successfully. Any payment refund has been queued.');
      if (onOrderUpdated) onOrderUpdated(updated);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  // Handle Return
  const handleConfirmReturn = async () => {
    setSubmittingReturn(true);
    setActionError('');
    setActionSuccess('');
    try {
      const fullReason = returnNotes.trim()
        ? `${returnReason} - ${returnNotes.trim()}`
        : returnReason;

      let res;
      if (isFpo) {
        res = await API.post(`/fpo-orders/${orderId}/consumer-return`, { reason: fullReason });
      } else {
        res = await API.post(`/orders/${orderId}/return`, { reason: fullReason });
      }

      const updated = res.data.order || res.data;
      setCurrentOrder(updated);
      setShowReturnSection(false);
      setActionSuccess('Return and refund request submitted. Our team will verify and process it shortly.');
      if (onOrderUpdated) onOrderUpdated(updated);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to submit return request');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Handle 1-Click Reorder
  const handleReorder = () => {
    if (isFpo) {
      addToCart(
        {
          _id: currentOrder.listing?._id || currentOrder.listing,
          produceType: itemName,
          pricePerKg: itemQty > 0 ? Math.round(itemPrice / itemQty) : itemPrice,
          images: currentOrder.listing?.images || [],
          grade: itemGrade,
          minOrderQtyKg: 1,
          fpo: currentOrder.fpo,
          buyerType: currentOrder.buyerType || 'INDIVIDUAL',
        },
        itemQty
      );
    } else {
      addToCart(
        {
          _id: currentOrder.produceId?._id || currentOrder.produceId,
          name: itemName,
          pricePerKg: itemQty > 0 ? Math.round(itemPrice / itemQty) : itemPrice,
          imageUrl: currentOrder.produceId?.imageUrl,
          farmerId: currentOrder.farmerId,
        },
        itemQty
      );
    }

    setActionSuccess(`${itemQty}kg of ${itemName} added to your cart!`);
    setTimeout(() => {
      onClose();
      setIsCartOpen(true);
    }, 800);
  };

  // Batch traceability link
  const batchId = currentOrder.listing?.sourceBatch || currentOrder.listing?.sourceIntakeId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📦</span>
              <h2 className="text-lg font-bold">Order Tracking & Receipt</h2>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">
                #{orderId.slice(-8).toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-emerald-100 mt-1">
              Placed on {new Date(currentOrder.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Alerts */}
          {actionSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <span>✅</span>
              <p>{actionSuccess}</p>
            </div>
          )}
          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <span>⚠️</span>
              <p>{actionError}</p>
            </div>
          )}

          {/* Stepper / Status Progress Bar */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200/70">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                Delivery Progress
              </h3>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  isCancelled
                    ? 'bg-red-100 text-red-700'
                    : isRefunded
                    ? 'bg-purple-100 text-purple-700'
                    : statusLower === 'delivered'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {status}
              </span>
            </div>

            {isCancelled ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                <p className="font-semibold flex items-center gap-1.5">
                  <span>🛑</span> Order Cancelled / Terminated
                </p>
                {currentOrder.cancelReason && (
                  <p className="text-xs text-red-700 mt-1">
                    <strong>Reason:</strong> {currentOrder.cancelReason}
                  </p>
                )}
                {currentOrder.rejectionReason && (
                  <p className="text-xs text-red-700 mt-1">
                    <strong>FPO Rejection Note:</strong> {currentOrder.rejectionReason}
                  </p>
                )}
                <div className="mt-2 pt-2 border-t border-red-200 flex items-center justify-between text-xs">
                  <span>Refund Status:</span>
                  <span className="font-semibold uppercase tracking-wider">
                    {currentOrder.refundStatus || 'NotRequired'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Horizontal Stepper */}
                <div className="hidden sm:flex items-center justify-between relative z-10">
                  {stages.map((stg, idx) => {
                    const isDone = currentStepIndex > idx || currentStepIndex === stages.length - 1;
                    const isCurrent = currentStepIndex === idx && currentStepIndex !== stages.length - 1;

                    return (
                      <div key={stg.key} className="flex-1 flex flex-col items-center text-center px-1">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition shadow-sm ${
                            isDone
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-emerald-100 text-emerald-800 ring-4 ring-emerald-300 animate-pulse'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <p
                          className={`mt-2 text-xs font-semibold ${
                            isDone || isCurrent ? 'text-gray-900' : 'text-gray-400'
                          }`}
                        >
                          {stg.label}
                        </p>
                        <p className="text-[10px] text-gray-400 max-w-[100px] leading-tight mt-0.5">
                          {stg.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Connecting background bar for desktop */}
                <div className="hidden sm:block absolute top-4 left-6 right-6 h-1 bg-gray-200 -z-0">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500"
                    style={{
                      width: `${
                        currentStepIndex < 0
                          ? 0
                          : (currentStepIndex / (stages.length - 1)) * 100
                      }%`,
                    }}
                  />
                </div>

                {/* Vertical Stepper for Mobile */}
                <div className="sm:hidden space-y-4">
                  {stages.map((stg, idx) => {
                    const isDone = currentStepIndex > idx || currentStepIndex === stages.length - 1;
                    const isCurrent = currentStepIndex === idx && currentStepIndex !== stages.length - 1;

                    return (
                      <div key={stg.key} className="flex items-start gap-3">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            isDone
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-300'
                              : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <div>
                          <p
                            className={`text-xs font-semibold ${
                              isDone || isCurrent ? 'text-gray-900' : 'text-gray-400'
                            }`}
                          >
                            {stg.label}
                          </p>
                          <p className="text-[11px] text-gray-500">{stg.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Order Details & Summary Card */}
          <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Produce Information
            </h4>
            <div className="flex gap-4 items-center">
              <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border">
                {resolvedImageUrl ? (
                  <img src={resolvedImageUrl} alt={itemName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🌱</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-base truncate">{itemName}</h3>
                  <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold">
                    Grade {itemGrade}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Supplied by: <span className="font-medium text-gray-700">{sellerName}</span>
                  {sellerLocation && ` · ${sellerLocation}`}
                </p>
                <p className="text-xs text-gray-500">
                  Quantity: <span className="font-bold text-gray-800">{itemQty} kg</span>
                  {isFpo && currentOrder.buyerType && (
                    <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                      Buyer: {currentOrder.buyerType}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-emerald-800">₹{itemPrice}</p>
                <p className="text-[11px] text-gray-400">
                  {itemQty > 0 ? `₹${(itemPrice / itemQty).toFixed(0)}/kg` : ''}
                </p>
              </div>
            </div>

            {/* Traceability Passport button if applicable */}
            {batchId && (
              <div className="pt-2 border-t flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/trace/${batchId}`);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-semibold transition"
                >
                  <span>🔍</span> View Digital Batch Passport & Origin Trace
                </button>
              </div>
            )}
          </div>

          {/* Delivery & Payment Information */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <span>📍</span> Delivery Address
              </h4>
              {currentOrder.deliveryAddress?.fullName ? (
                <div className="text-xs text-gray-700 space-y-0.5">
                  <p className="font-bold text-gray-900">{currentOrder.deliveryAddress.fullName}</p>
                  <p>{currentOrder.deliveryAddress.streetAddress}</p>
                  {currentOrder.deliveryAddress.landmark && (
                    <p className="text-gray-500">Landmark: {currentOrder.deliveryAddress.landmark}</p>
                  )}
                  <p>
                    {currentOrder.deliveryAddress.city}
                    {currentOrder.deliveryAddress.state ? `, ${currentOrder.deliveryAddress.state}` : ''}{' '}
                    - {currentOrder.deliveryAddress.pincode}
                  </p>
                  <p className="pt-1 text-gray-500">Phone: {currentOrder.deliveryAddress.phone}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Standard registered address</p>
              )}
            </div>

            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <span>💳</span> Payment & Slot
              </h4>
              <div className="text-xs text-gray-700 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Slot:</span>
                  <span className="font-semibold text-gray-800">{currentOrder.deliverySlot || 'Standard Delivery'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Method:</span>
                  <span className="font-semibold text-gray-800">{currentOrder.paymentMethod || 'CARD'}</span>
                </div>
                {currentOrder.couponCode && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Coupon ({currentOrder.couponCode}):</span>
                    <span>-₹{currentOrder.discountAmount || 0}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t font-bold text-gray-900">
                  <span>Grand Total:</span>
                  <span className="text-emerald-800">₹{itemPrice}</span>
                </div>
                {currentOrder.refundStatus && currentOrder.refundStatus !== 'NotRequired' && (
                  <div className="flex justify-between pt-1 text-amber-700 font-semibold">
                    <span>Refund:</span>
                    <span>{currentOrder.refundStatus}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Post-Purchase Actions Form: Cancel Order Confirmation */}
          {showCancelSection && (
            <div className="border-2 border-red-200 bg-red-50/40 rounded-xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-red-900 flex items-center gap-1.5">
                  <span>⚠️</span> Confirm Cancellation
                </h4>
                <button
                  type="button"
                  onClick={() => setShowCancelSection(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-red-700">
                Are you sure you want to cancel this order? The produce stock will be restored immediately.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Cancellation
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white outline-none focus:border-red-500"
                >
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Found better price elsewhere">Found better price elsewhere</option>
                  <option value="Delivery time is too long">Delivery time is too long</option>
                  <option value="Incorrect delivery address">Incorrect delivery address</option>
                  <option value="Other">Other reason</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Need to adjust the delivery date"
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white outline-none focus:border-red-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelSection(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={cancelling}
                  className="px-4 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
                </button>
              </div>
            </div>
          )}

          {/* Post-Purchase Actions Form: Return / Refund Request */}
          {showReturnSection && (
            <div className="border-2 border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                  <span>↩️</span> Request Return & Refund
                </h4>
                <button
                  type="button"
                  onClick={() => setShowReturnSection(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-amber-800">
                Our farm quality guarantee ensures fresh produce. If the delivered produce didn't meet quality standards, submit your claim below.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Issue Type
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white outline-none focus:border-amber-500"
                >
                  <option value="Damaged or spoiled produce">Damaged or spoiled produce</option>
                  <option value="Quality not as expected / Rotten">Quality not as expected / Rotten</option>
                  <option value="Wrong produce or grade delivered">Wrong produce or grade delivered</option>
                  <option value="Weight discrepancy / Less quantity">Weight discrepancy / Less quantity</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Problem Description
                </label>
                <textarea
                  rows="2"
                  placeholder="Describe the issue with the delivered produce..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReturnSection(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  disabled={submittingReturn}
                  className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {submittingReturn ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </div>
          )}

          {/* Refund Status Banner if already requested */}
          {currentOrder.refundStatus === 'Pending' && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 text-xs flex items-start gap-3">
              <span className="text-lg">⏳</span>
              <div>
                <p className="font-bold">Refund / Return Request Pending Review</p>
                <p className="text-amber-800 mt-0.5">
                  Your return request for this order is being reviewed by the farm administrator. Refund will be processed to your original payment method.
                </p>
                {currentOrder.returnReason && (
                  <p className="text-amber-700 mt-1 italic">"{currentOrder.returnReason}"</p>
                )}
              </div>
            </div>
          )}
          {currentOrder.refundStatus === 'Processed' && (
            <div className="bg-purple-50 border border-purple-300 text-purple-900 rounded-xl p-4 text-xs flex items-start gap-3">
              <span className="text-lg">💳</span>
              <div>
                <p className="font-bold">Refund Processed Successfully</p>
                <p className="text-purple-800 mt-0.5">
                  The refund of ₹{itemPrice} has been approved and issued to your payment account.
                </p>
                {currentOrder.refundTransactionId && (
                  <p className="font-mono text-purple-700 mt-1">
                    Transaction Ref: {currentOrder.refundTransactionId}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Cancel Button */}
            {canCancel && !showCancelSection && (
              <button
                type="button"
                onClick={() => {
                  setShowCancelSection(true);
                  setShowReturnSection(false);
                }}
                className="px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl transition"
              >
                Cancel Order
              </button>
            )}

            {/* Return Request Button */}
            {canReturn && !showReturnSection && (
              <button
                type="button"
                onClick={() => {
                  setShowReturnSection(true);
                  setShowCancelSection(false);
                }}
                className="px-3 py-2 text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 border border-amber-200 rounded-xl transition"
              >
                Request Return / Refund
              </button>
            )}

            {/* Rate Produce Button */}
            {statusLower === 'delivered' && (
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(true)}
                className="px-3 py-2 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition flex items-center gap-1"
              >
                <span>⭐</span> Rate Produce
              </button>
            )}

            {/* View Official Invoice Button */}
            <button
              type="button"
              onClick={() => setIsInvoiceOpen(true)}
              className="px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <span>🧾</span> View Invoice
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* 1-Click Reorder Button */}
            <button
              type="button"
              onClick={handleReorder}
              className="px-4 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <span>🔁</span> Buy Again (Reorder)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Official Tax Invoice Modal */}
      <InvoiceModal
        order={currentOrder}
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
      />

      {/* Review Modal */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        targetType={isFpo ? 'Listing' : 'Produce'}
        targetId={
          isFpo
            ? currentOrder.listing?._id || currentOrder.listing
            : currentOrder.produceId?._id || currentOrder.produceId
        }
        productName={itemName}
        productImage={imageUrl || ''}
        grade={itemGrade}
        onReviewSubmitted={() => {
          setActionSuccess('Review submitted! Thank you for rating this farm produce.');
        }}
      />
    </div>
  );
}
