import React from 'react';
import BrandLogo from './BrandLogo';

export default function InvoiceModal({ order, isOpen, onClose }) {
  if (!isOpen || !order) return null;

  const orderId = order._id;
  const shortId = orderId ? orderId.toString().slice(-8).toUpperCase() : 'N/A';
  const invoiceNumber = `FF-${shortId}-${new Date(order.createdAt || Date.now()).getFullYear()}`;
  const orderDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const itemName = order.listing?.produceType || 'FPO Produce';
  const itemGrade = order.gradeOrdered || order.listing?.grade || 'A';
  const itemQty = order.quantityKg || 0;
  const totalPrice = Number(order.totalPrice || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const subtotal = totalPrice + discountAmount;
  const unitPrice = itemQty > 0 ? Math.round(subtotal / itemQty) : (order.listing?.pricePerKg || 0);

  const sellerName = order.fpo?.name || 'Associated Farmer Producer Organization';
  const sellerLocation = order.fpo?.contactDetails?.address || order.fpo?.location || 'FPO Hub';
  const sellerReg = order.fpo?.registrationNumber ? order.fpo.registrationNumber : null;

  const customerName = order.deliveryAddress?.fullName || order.consumerId?.name || 'Valued Customer';
  const customerPhone = order.deliveryAddress?.phone || order.consumerId?.phone || 'N/A';
  const street = order.deliveryAddress?.streetAddress || '';
  const landmark = order.deliveryAddress?.landmark ? `, Near ${order.deliveryAddress.landmark}` : '';
  const city = order.deliveryAddress?.city || '';
  const state = order.deliveryAddress?.state || '';
  const pincode = order.deliveryAddress?.pincode || '';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* Container with print-specific stylesheet */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-gray-200">
        <style>
          {`
            @media print {
              body * {
                visibility: hidden;
              }
              #printable-invoice, #printable-invoice * {
                visibility: visible;
              }
              #printable-invoice {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 24px;
                background: white !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}
        </style>

        {/* Modal Top Action Bar (hidden in print) */}
        <div className="no-print bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧾</span>
            <span className="font-bold text-sm tracking-wide">Official Order Invoice</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-white/20"
            >
              <span>🖨️</span> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-lg font-bold px-2 py-1 rounded hover:bg-white/10 transition"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div id="printable-invoice" className="p-8 text-gray-800 bg-white">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-gray-200 pb-6 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BrandLogo size="md" />
              </div>
              <p className="text-xs text-gray-500 font-medium">Farm-to-Door Agricultural Network</p>
              <p className="text-xs text-gray-400 mt-0.5">Website: www.farmfresh.local · Support: help@farmfresh.local</p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-emerald-100 text-emerald-900 font-bold text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded mb-2">
                Tax Invoice / Cash Memo
              </span>
              <p className="text-xs font-semibold text-gray-900">Invoice: <span className="font-mono text-emerald-800">{invoiceNumber}</span></p>
              <p className="text-xs text-gray-500 mt-0.5">Order Ref: #{shortId}</p>
              <p className="text-xs text-gray-500">{orderDate}</p>
            </div>
          </div>

          {/* Parties Info Grid */}
          <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 rounded-xl mb-6 border border-gray-100 text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Sold By (FPO / Producer)</p>
              <p className="font-bold text-gray-900 text-sm">{sellerName}</p>
              <p className="text-gray-600 mt-0.5">{sellerLocation}</p>
              {sellerReg && <p className="text-gray-500 mt-0.5">FPO Reg No: <span className="font-mono">{sellerReg}</span></p>}
              <p className="text-emerald-700 font-medium mt-1">✓ Quality Certified Harvest</p>
            </div>

            <div className="border-l border-gray-200 pl-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Billed & Delivered To</p>
              <p className="font-bold text-gray-900 text-sm">{customerName}</p>
              <p className="text-gray-600 mt-0.5">📞 {customerPhone}</p>
              <p className="text-gray-600 mt-1 leading-relaxed">
                {street}{landmark}
                {city && <><br />{city}, {state} - <span className="font-semibold">{pincode}</span></>}
              </p>
            </div>
          </div>

          {/* Delivery & Payment Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6 pb-4 border-b border-gray-200 text-xs">
            <div>
              <span className="text-gray-500">Delivery Slot: </span>
              <span className="font-semibold text-gray-800">{order.deliverySlot || 'Standard Delivery (8 AM - 12 PM)'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Payment: </span>
              <span className="font-semibold text-gray-800 uppercase font-mono bg-gray-100 px-2 py-0.5 rounded">
                {order.paymentMethod || 'CARD'}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid / Confirmed'}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Item Description</th>
                  <th className="py-2.5 px-3 text-center">Grade</th>
                  <th className="py-2.5 px-3 text-right">Qty (Kg)</th>
                  <th className="py-2.5 px-4 text-right">Rate (₹/Kg)</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                <tr>
                  <td className="py-3 px-4 font-mono text-gray-400">1</td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-gray-900">{itemName}</p>
                    <p className="text-[11px] text-gray-500">Harvested fresh · Cold-chain packed</p>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-block font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                      Grade {itemGrade}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-medium">{itemQty} kg</td>
                  <td className="py-3 px-4 text-right">₹{unitPrice}</td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">₹{subtotal}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pricing Summary */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Items Subtotal</span>
                <span className="font-medium text-gray-900">₹{subtotal}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Promo Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                  <span>- ₹{discountAmount}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Direct Delivery & Handling</span>
                <span className="text-emerald-700 font-semibold uppercase text-[11px]">FREE</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-300 text-sm font-bold text-gray-900">
                <span>Net Total Paid</span>
                <span className="text-base text-emerald-800 font-black">₹{totalPrice}</span>
              </div>
            </div>
          </div>

          {/* Footer & Quality Guarantee Notice */}
          <div className="border-t border-dashed border-gray-300 pt-5 text-[11px] text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-700">🌱 100% Quality & Freshness Guarantee</p>
              <p className="text-gray-400 mt-0.5">Every batch is verified by affiliated FPOs and harvested within 24-48 hours of dispatch.</p>
            </div>
            <div className="text-right">
              <p className="italic text-gray-400">Computer generated bill · No signature required</p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Bar (hidden in print) */}
        <div className="no-print bg-gray-50 px-6 py-3.5 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-100 transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition flex items-center gap-1.5 shadow-sm"
          >
            <span>🖨️</span> Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}