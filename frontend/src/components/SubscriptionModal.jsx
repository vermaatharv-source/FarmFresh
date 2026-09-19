import React, { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function SubscriptionModal({
  isOpen,
  onClose,
  item,
  itemType = 'FPO',
  onSubscribed,
}) {
  const { user } = useAuth();

  const minQty = item?.minOrderQtyKg || 1;
  const [quantityKg, setQuantityKg] = useState(minQty);
  const [frequency, setFrequency] = useState('Weekly');
  const [deliveryDay, setDeliveryDay] = useState('Monday');
  const [deliverySlot, setDeliverySlot] = useState('Morning (6:00 AM - 9:00 AM)');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const addresses = user?.addresses || [];

  useEffect(() => {
    if (item) {
      setQuantityKg(Math.max(1, item.minOrderQtyKg || 1));
      setError('');
      setSuccess('');
    }
    if (addresses.length > 0) {
      const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
      setSelectedAddressId(defaultAddr._id);
    }
  }, [item, user]);

  if (!isOpen || !item) return null;

  const productName = item.produceType || item.name || 'Farm Produce';
  const unitPrice = item.pricePerKg || 0;
  const basePrice = Math.round(unitPrice * quantityKg);
  const discountAmount = Math.round(basePrice * 0.05); // 5% Subscribe & Save
  const finalPrice = Math.max(0, basePrice - discountAmount);

  // Compute next delivery date preview
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIdx = dayNames.indexOf(deliveryDay);
  const now = new Date();
  let daysDiff = targetDayIdx - now.getDay();
  if (daysDiff <= 1) daysDiff += 7;
  const nextDeliveryDate = new Date(now.getTime() + daysDiff * 24 * 60 * 60 * 1000);
  const datePreviewStr = nextDeliveryDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to start a subscription.');
      return;
    }

    const chosenAddr = addresses.find((a) => a._id === selectedAddressId) || addresses[0];
    if (!chosenAddr) {
      setError('Please save a delivery address in your account first.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      const res = await API.post('/subscriptions', {
        itemType,
        listingId: item._id,
        quantityKg,
        frequency,
        deliveryDay,
        deliverySlot,
        deliveryAddress: {
          fullName: chosenAddr.fullName,
          phone: chosenAddr.phone,
          streetAddress: chosenAddr.streetAddress,
          landmark: chosenAddr.landmark || '',
          city: chosenAddr.city,
          state: chosenAddr.state || '',
          pincode: chosenAddr.pincode,
        },
        paymentMethod,
        notes,
      });

      setSuccess(`Subscribed! First delivery scheduled on ${datePreviewStr}`);
      if (onSubscribed) {
        onSubscribed(res.data.subscription);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create subscription.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🔁</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Subscribe & Save (5% Off)</h2>
                <span className="text-[10px] bg-amber-400 text-gray-900 font-extrabold px-2 py-0.5 rounded-full">
                  SAVE 5%
                </span>
              </div>
              <p className="text-xs text-emerald-100">Recurring fresh harvest delivered right to your door</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Alerts */}
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

          {/* Product Summary */}
          <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-sm">{productName}</h3>
                {item.grade && (
                  <span className="text-[10px] font-semibold bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">
                    Grade {item.grade}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Regular Price: ₹{unitPrice}/kg</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 line-through">₹{basePrice}</span>
              <p className="text-base font-extrabold text-emerald-800">
                ₹{finalPrice} <span className="text-[11px] font-normal text-gray-500">/ delivery</span>
              </p>
            </div>
          </div>

          {/* Quantity Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Quantity Per Delivery
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 5, 10].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantityKg(q)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    quantityKg === q
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {q} kg
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={quantityKg}
                  onChange={(e) => setQuantityKg(Math.max(0.5, Number(e.target.value)))}
                  className="w-16 text-xs text-center border border-gray-300 rounded-lg py-1.5 outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-gray-500">kg</span>
              </div>
            </div>
          </div>

          {/* Frequency & Weekday */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:border-emerald-500"
              >
                <option value="Weekly">Every Week (Recommended)</option>
                <option value="BiWeekly">Every 2 Weeks</option>
                <option value="Monthly">Once a Month</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                Delivery Day
              </label>
              <select
                value={deliveryDay}
                onChange={(e) => setDeliveryDay(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:border-emerald-500"
              >
                {dayNames.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delivery Slot */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Preferred Time Window
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Morning', time: '6:00 AM - 9:00 AM' },
                { label: 'Standard', time: '10:00 AM - 2:00 PM' },
                { label: 'Evening', time: '5:00 PM - 8:00 PM' },
              ].map((slot) => {
                const fullSlot = `${slot.label} (${slot.time})`;
                return (
                  <button
                    key={slot.label}
                    type="button"
                    onClick={() => setDeliverySlot(fullSlot)}
                    className={`p-2 rounded-xl border text-center transition ${
                      deliverySlot === fullSlot
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-xs font-bold">{slot.label}</p>
                    <p className="text-[9px] text-gray-400">{slot.time}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delivery Address Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Delivery Address
            </label>
            {addresses.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Please add a delivery address under "My Account" before subscribing.
              </p>
            ) : (
              <select
                value={selectedAddressId}
                onChange={(e) => setSelectedAddressId(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:border-emerald-500"
              >
                {addresses.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.label || 'Home'}: {a.streetAddress}, {a.city} ({a.phone})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Next Delivery Date Box */}
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-teal-900">
              <span className="text-lg">🗓️</span>
              <div>
                <p className="font-semibold">Next Scheduled Delivery:</p>
                <p className="text-teal-700">{datePreviewStr} · {deliverySlot}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-teal-200 text-teal-900 px-2 py-0.5 rounded">
              Flexible / Pause Anytime
            </span>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['CARD', 'UPI', 'COD'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`p-2 rounded-lg text-xs font-semibold border transition ${
                    paymentMethod === method
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {method === 'COD' ? '💵 Cash' : method === 'UPI' ? '📱 UPI' : '💳 Card'}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Special Instructions (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Ring doorbell, leave with security"
              className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:border-emerald-500"
            />
          </div>

          {/* Buttons */}
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
              disabled={submitting || addresses.length === 0}
              className="px-5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Setting up...' : `Subscribe · ₹${finalPrice}/delivery`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}