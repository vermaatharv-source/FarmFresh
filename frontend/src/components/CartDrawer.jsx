import React from 'react';
import { useCart } from '../context/CartContext';

export default function CartDrawer() {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeFromCart,
    clearCart,
    cartTotal,
    setIsCheckoutOpen,
  } = useCart();

  if (!isCartOpen) return null;

  const deliveryFee = cartTotal >= 500 || cartTotal === 0 ? 0 : 40;
  const grandTotal = cartTotal + deliveryFee;

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const gradeColors = {
    A: 'bg-emerald-700 text-white',
    B: 'bg-amber-600 text-white',
    C: 'bg-orange-600 text-white',
    Custom: 'bg-slate-600 text-white',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛒</span>
              <h2 className="text-lg font-bold">Shopping Cart ({cart.length})</h2>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 transition font-bold"
            >
              ✕
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-6xl block mb-3">🧺</span>
                <p className="text-gray-700 font-semibold text-lg">Your cart is empty</p>
                <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto">
                  Add fresh, traceable produce from verified farmers and FPOs to start your harvest basket.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="mt-6 bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-800 transition"
                >
                  Browse Marketplace
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-xl p-3.5 flex gap-3 hover:border-emerald-200 transition bg-white"
                >
                  {/* Image */}
                  <div className="w-20 h-20 bg-emerald-50 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border">
                    {item.imageUrl ? (
                      <img
                        src={
                          item.imageUrl.startsWith('http')
                            ? item.imageUrl
                            : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
                                .replace('/api', '')}/${item.imageUrl.replace(/^.*uploads/, 'uploads')}`
                        }
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl">🥬</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{item.name}</h4>
                          <p className="text-[11px] text-gray-500">By {item.seller}</p>
                        </div>
                        {item.grade && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              gradeColors[item.grade] || 'bg-gray-600 text-white'
                            }`}
                          >
                            Grade {item.grade}
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-sm font-bold text-emerald-800">₹{item.pricePerKg}/kg</span>
                        {item.buyerType && item.buyerType !== 'INDIVIDUAL' && (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded">
                            {item.buyerType}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Stepper & Price */}
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2.5 py-0.5 text-gray-600 hover:bg-gray-100 font-bold text-sm"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-bold text-gray-800">{item.quantity} kg</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.availableStock}
                          className="px-2.5 py-0.5 text-gray-600 hover:bg-gray-100 font-bold text-sm disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">
                          ₹{(item.pricePerKg * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          title="Remove item"
                          className="text-gray-400 hover:text-red-500 p-1 text-sm transition"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Summary */}
          {cart.length > 0 && (
            <div className="p-6 bg-gray-50 border-t space-y-3">
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-800">₹{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  {deliveryFee === 0 ? (
                    <span className="font-bold text-emerald-700">FREE</span>
                  ) : (
                    <span className="font-semibold text-gray-800">₹{deliveryFee}</span>
                  )}
                </div>
                {deliveryFee > 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    Add ₹{(500 - cartTotal).toFixed(0)} more for FREE standard delivery!
                  </p>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t">
                  <span>Estimated Total</span>
                  <span className="text-emerald-800 text-base">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={clearCart}
                  className="px-3 py-2.5 border border-gray-300 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
                >
                  Clear
                </button>
                <button
                  onClick={handleProceedToCheckout}
                  className="flex-1 bg-emerald-700 text-white py-2.5 rounded-xl font-bold hover:bg-emerald-800 transition text-sm shadow-sm"
                >
                  Proceed to Checkout →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
