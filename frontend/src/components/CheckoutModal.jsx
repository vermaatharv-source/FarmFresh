import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

export default function CheckoutModal() {
  const { isCheckoutOpen, setIsCheckoutOpen, cart, cartTotal, clearCart } = useCart();
  const { user, updateUser } = useAuth();

  const [addresses, setAddresses] = useState(user?.addresses || []);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [deliverySlot, setDeliverySlot] = useState('Tomorrow, Morning (7:00 AM - 11:00 AM)');
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  
  // Inline add address state
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    fullName: user?.name || '',
    phone: user?.phone || '',
    streetAddress: '',
    landmark: '',
    city: user?.location || '',
    state: '',
    pincode: '',
    isDefault: true,
  });

  // Card details state
  const [cardData, setCardData] = useState({ number: '', expiry: '', cvv: '', name: user?.name || '' });

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  // Processing & Confirmation state
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [completedOrder, setCompletedOrder] = useState(null);

  useEffect(() => {
    if (isCheckoutOpen) {
      // Load latest addresses
      const fetchAddresses = async () => {
        try {
          const res = await API.get('/auth/addresses');
          setAddresses(res.data);
          const defaultAddr = res.data.find((a) => a.isDefault) || res.data[0];
          if (defaultAddr) setSelectedAddressId(defaultAddr._id);
        } catch {
          if (user?.addresses?.length) {
            setAddresses(user.addresses);
            const defaultAddr = user.addresses.find((a) => a.isDefault) || user.addresses[0];
            if (defaultAddr) setSelectedAddressId(defaultAddr._id);
          }
        }
      };
      fetchAddresses();
      setCompletedOrder(null);
      setCheckoutError('');
    }
  }, [isCheckoutOpen, user]);

  if (!isCheckoutOpen) return null;

  const deliveryFee = cartTotal >= 500 || cartTotal === 0 ? 0 : 40;
  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const grandTotal = Math.max(0, cartTotal + deliveryFee - discountAmount);

  const handleApplyCoupon = async (codeToUse) => {
    const code = (codeToUse || couponCode).trim().toUpperCase();
    setCouponError('');
    if (!code) return;

    try {
      const res = await API.post('/orders/validate-coupon', {
        couponCode: code,
        subtotal: cartTotal,
      });
      setAppliedCoupon(res.data);
      setCouponCode(code);
    } catch (err) {
      setCouponError(err.response?.data?.message || 'Invalid coupon code');
      setAppliedCoupon(null);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const handleSaveInlineAddress = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/auth/addresses', newAddress);
      setAddresses(res.data);
      if (updateUser) updateUser({ addresses: res.data });
      const added = res.data[res.data.length - 1];
      if (added) setSelectedAddressId(added._id);
      setShowAddAddress(false);
    } catch (err) {
      setCheckoutError(err.response?.data?.message || 'Failed to save address');
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setCheckoutError('');

    const targetAddress = addresses.find((a) => a._id === selectedAddressId);
    if (!targetAddress) {
      setCheckoutError('Please select or add a delivery address.');
      return;
    }

    if (paymentMethod === 'CARD') {
      const cleanNum = cardData.number.replace(/\s/g, '');
      if (cleanNum.length !== 16) {
        setCheckoutError('Please enter a valid 16-digit card number.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cardData.expiry)) {
        setCheckoutError('Please enter card expiry as MM/YY.');
        return;
      }
      if (cardData.cvv.length !== 3) {
        setCheckoutError('Please enter a 3-digit CVV.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        items: cart.map((item) => ({
          type: item.type,
          id: item.id,
          quantity: item.quantity,
          name: item.name,
          buyerType: item.buyerType || 'INDIVIDUAL',
        })),
        deliveryAddress: {
          fullName: targetAddress.fullName,
          phone: targetAddress.phone,
          streetAddress: targetAddress.streetAddress,
          landmark: targetAddress.landmark || '',
          city: targetAddress.city,
          state: targetAddress.state,
          pincode: targetAddress.pincode,
        },
        deliverySlot,
        paymentMethod,
        couponCode: appliedCoupon ? appliedCoupon.code : '',
      };

      const res = await API.post('/orders/checkout', payload);
      setCompletedOrder({
        ...res.data.orderSummary,
        items: [...cart],
      });
      clearCart();
    } catch (err) {
      setCheckoutError(err.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden my-8 border">
        {/* Header */}
        <div className="bg-emerald-800 text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>🌱</span> {completedOrder ? 'Order Confirmed & Tax Invoice' : 'Complete Your Order'}
            </h2>
            <p className="text-emerald-200 text-xs mt-0.5">
              {completedOrder
                ? 'Thank you! Your fresh farm produce has been reserved.'
                : 'Direct from verified local farmers and FPOs to your doorstep.'}
            </p>
          </div>
          {!submitting && (
            <button
              onClick={() => setIsCheckoutOpen(false)}
              className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 transition font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* ==================== SUCCESSFUL ORDER INVOICE VIEW ==================== */}
        {completedOrder ? (
          <div className="p-6 space-y-6">
            <div className="text-center py-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="text-lg font-bold text-emerald-900">Payment & Order Successful!</h3>
              <p className="text-xs text-emerald-700 mt-1">
                Your order is confirmed and routed for packing & dispatch.
              </p>
            </div>

            {/* Invoice Meta */}
            <div className="border rounded-xl p-4 bg-gray-50/50 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice Reference:</span>
                <span className="font-mono font-bold text-gray-800">
                  INV-{Date.now().toString().slice(-8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Placed On:</span>
                <span className="font-semibold text-gray-800">
                  {new Date(completedOrder.placedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery Slot:</span>
                <span className="font-semibold text-gray-800">{completedOrder.deliverySlot}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Mode:</span>
                <span className="font-semibold text-gray-800">{completedOrder.paymentMethod} (Verified)</span>
              </div>
              <div className="pt-2 border-t text-gray-700">
                <span className="font-semibold text-gray-900 block mb-0.5">Delivery Address:</span>
                {completedOrder.deliveryAddress.fullName} · {completedOrder.deliveryAddress.phone}
                <br />
                {completedOrder.deliveryAddress.streetAddress}, {completedOrder.deliveryAddress.city},{' '}
                {completedOrder.deliveryAddress.state} - {completedOrder.deliveryAddress.pincode}
              </div>
            </div>

            {/* Items Table */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 grid grid-cols-12">
                <span className="col-span-6">Produce Item</span>
                <span className="col-span-3 text-center">Qty (kg)</span>
                <span className="col-span-3 text-right">Amount</span>
              </div>
              <div className="divide-y text-xs">
                {completedOrder.items.map((it, idx) => (
                  <div key={idx} className="px-4 py-2.5 grid grid-cols-12 items-center">
                    <div className="col-span-6">
                      <p className="font-bold text-gray-900">{it.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {it.grade ? `Grade ${it.grade} · ` : ''}By {it.seller}
                      </p>
                    </div>
                    <span className="col-span-3 text-center font-semibold text-gray-800">
                      {it.quantity} kg
                    </span>
                    <span className="col-span-3 text-right font-bold text-emerald-800">
                      ₹{(it.pricePerKg * it.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-50/50 p-4 border-t space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-semibold">₹{completedOrder.subtotal.toFixed(2)}</span>
                </div>
                {completedOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Discount Applied</span>
                    <span>-₹{completedOrder.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t">
                  <span>Total Amount Paid</span>
                  <span className="text-emerald-800 text-base">₹{completedOrder.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handlePrint}
                className="flex-1 border border-gray-300 py-2.5 rounded-xl font-bold text-xs text-gray-700 hover:bg-gray-50 transition"
              >
                🖨️ Print / Save Invoice
              </button>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="flex-1 bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-emerald-800 transition"
              >
                Done Shopping
              </button>
            </div>
          </div>
        ) : (
          /* ==================== ACTIVE CHECKOUT FLOW ==================== */
          <form onSubmit={handlePlaceOrder} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {checkoutError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-xs">
                {checkoutError}
              </div>
            )}

            {/* Step 1: Delivery Address */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <span>📍</span> 1. Select Delivery Address
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddAddress(!showAddAddress)}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  {showAddAddress ? 'Cancel' : '+ Add New Address'}
                </button>
              </div>

              {showAddAddress ? (
                <div className="border rounded-xl p-4 bg-emerald-50/40 space-y-3">
                  <h4 className="text-xs font-bold text-gray-800">Add Delivery Location</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Recipient Full Name"
                      value={newAddress.fullName}
                      onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                      required
                      className="border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      required
                      className="border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="House/Street/Flat No."
                    value={newAddress.streetAddress}
                    onChange={(e) => setNewAddress({ ...newAddress, streetAddress: e.target.value })}
                    required
                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="City"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      required
                      className="border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="State"
                      value={newAddress.state}
                      onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                      required
                      className="border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={newAddress.pincode}
                      onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                      required
                      className="border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveInlineAddress}
                    className="bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-emerald-800 transition"
                  >
                    Save & Use This Address
                  </button>
                </div>
              ) : addresses.length === 0 ? (
                <div className="p-4 border border-dashed rounded-xl text-center">
                  <p className="text-xs text-gray-500 mb-2">No delivery addresses saved yet.</p>
                  <button
                    type="button"
                    onClick={() => setShowAddAddress(true)}
                    className="bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg"
                  >
                    + Add Address
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {addresses.map((addr) => (
                    <label
                      key={addr._id}
                      className={`border rounded-xl p-3 cursor-pointer transition flex items-start gap-2.5 text-xs ${
                        selectedAddressId === addr._id
                          ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectedAddress"
                        checked={selectedAddressId === addr._id}
                        onChange={() => setSelectedAddressId(addr._id)}
                        className="mt-0.5 text-emerald-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-bold text-gray-900">{addr.fullName}</span>
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 rounded font-medium">
                            {addr.label || 'Home'}
                          </span>
                        </div>
                        <p className="text-gray-500 leading-tight">
                          {addr.streetAddress}, {addr.city} ({addr.pincode})
                        </p>
                        <p className="text-[11px] text-emerald-800 font-medium mt-1">📞 {addr.phone}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Delivery Slot */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <span>⏰</span> 2. Choose Delivery Slot
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {[
                  'Tomorrow, Early Morning (6:00 AM - 9:00 AM)',
                  'Tomorrow, Standard (10:00 AM - 2:00 PM)',
                  'Tomorrow, Evening (5:00 PM - 8:00 PM)',
                ].map((slot) => (
                  <label
                    key={slot}
                    className={`border rounded-xl p-3 cursor-pointer text-center transition flex flex-col items-center justify-center gap-1 ${
                      deliverySlot === slot
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 font-bold'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliverySlot"
                      checked={deliverySlot === slot}
                      onChange={() => setDeliverySlot(slot)}
                      className="sr-only"
                    />
                    <span>{slot.split(' (')[0]}</span>
                    {slot.includes(' (') && (
                      <span className="text-[11px] text-gray-500 font-normal">
                        {`(${slot.split(' (')[1]}`}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Step 3: Promo / Coupon Code */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <span>🏷️</span> 3. Apply Harvest Coupon
              </h3>
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                  <div>
                    <span className="font-bold text-emerald-900">{appliedCoupon.code} Applied</span>
                    <p className="text-emerald-700 text-[11px]">{appliedCoupon.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs text-red-600 hover:underline font-bold"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter coupon (e.g. FRESH10, WELCOME50)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 border rounded-lg px-3 py-2 text-xs uppercase outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    className="bg-gray-800 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gray-900 transition"
                  >
                    Apply
                  </button>
                </div>
              )}
              {couponError && <p className="text-red-600 text-xs">{couponError}</p>}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-gray-400">Try:</span>
                {['FRESH10', 'WELCOME50', 'KISANFEST'].map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => handleApplyCoupon(c)}
                    className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-mono font-semibold px-2 py-0.5 rounded border border-emerald-200 transition"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: Payment Method */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <span>💳</span> 4. Payment Method
              </h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { id: 'CARD', label: 'Credit/Debit Card' },
                  { id: 'UPI', label: 'UPI / QR Code' },
                  { id: 'COD', label: 'Cash on Delivery' },
                ].map((pm) => (
                  <label
                    key={pm.id}
                    className={`border rounded-xl p-3 cursor-pointer text-center transition flex flex-col items-center justify-center gap-1 ${
                      paymentMethod === pm.id
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 font-bold'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === pm.id}
                      onChange={() => setPaymentMethod(pm.id)}
                      className="sr-only"
                    />
                    <span>{pm.label}</span>
                  </label>
                ))}
              </div>

              {paymentMethod === 'CARD' && (
                <div className="border rounded-xl p-4 bg-gray-50/50 space-y-2.5">
                  <input
                    type="text"
                    placeholder="Cardholder Full Name"
                    value={cardData.name}
                    onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                    required
                    className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="16-Digit Card Number"
                    maxLength={19}
                    value={cardData.number}
                    onChange={(e) => {
                      const val = e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 16)
                        .replace(/(.{4})/g, '$1 ')
                        .trim();
                      setCardData({ ...cardData, number: val });
                    }}
                    required
                    className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-mono"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="MM/YY"
                      maxLength={5}
                      value={cardData.expiry}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        if (val.length >= 3) val = val.slice(0, 2) + '/' + val.slice(2);
                        setCardData({ ...cardData, expiry: val });
                      }}
                      required
                      className="w-1/2 border rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-mono"
                    />
                    <input
                      type="password"
                      placeholder="CVV"
                      maxLength={3}
                      value={cardData.cvv}
                      onChange={(e) => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                      required
                      className="w-1/2 border rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'UPI' && (
                <div className="border rounded-xl p-4 bg-emerald-50/40 text-center space-y-2">
                  <span className="text-3xl block">📱</span>
                  <p className="text-xs font-bold text-gray-800">Scan UPI QR / VPA Prompt</p>
                  <p className="text-[11px] text-gray-500">
                    A simulated UPI authorization request will complete automatically on clicking confirm.
                  </p>
                </div>
              )}

              {paymentMethod === 'COD' && (
                <div className="border rounded-xl p-4 bg-amber-50 text-center text-xs text-amber-800">
                  💵 Pay cash or via UPI to the delivery executive upon arrival at your doorstep.
                </div>
              )}
            </div>

            {/* Order Price Breakdown */}
            <div className="border rounded-xl p-4 bg-gray-50 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Items Subtotal ({cart.length} produce types)</span>
                <span className="font-semibold text-gray-900">₹{cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Standard Delivery Fee</span>
                {deliveryFee === 0 ? (
                  <span className="font-bold text-emerald-700">FREE</span>
                ) : (
                  <span className="font-semibold text-gray-900">₹{deliveryFee}</span>
                )}
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Coupon Discount ({appliedCoupon.code})</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t">
                <span>Grand Total</span>
                <span className="text-emerald-800 text-base">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || cart.length === 0}
              className="w-full bg-emerald-700 text-white py-3 rounded-xl font-bold hover:bg-emerald-800 transition disabled:opacity-60 text-sm shadow-sm"
            >
              {submitting ? 'Securing Stock & Placing Order...' : `Confirm & Pay ₹${grandTotal.toFixed(2)}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
