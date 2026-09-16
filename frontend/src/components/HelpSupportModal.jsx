import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function HelpSupportModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [activeFaq, setActiveFaq] = useState(null);
  const [formCategory, setFormCategory] = useState('Quality / Spoiled Produce');
  const [orderRef, setOrderRef] = useState('');
  const [message, setMessage] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const faqs = [
    {
      q: 'How does the Farm-to-Door delivery work?',
      a: 'Produce is harvested from partner farmers within 24-48 hours of dispatch. Affiliated FPOs grade the produce, maintain cold-chain handling, and hand over to our local delivery fleet to reach your doorstep during your chosen morning or evening slot.',
    },
    {
      q: 'What is the difference between Grade A, Grade B, and Grade C?',
      a: 'Grade A represents premium export-grade produce with uniform size, zero physical blemishes, and peak ripeness. Grade B has identical nutritional quality with minor shape/size variations at high value. Grade C is economical utility produce suited for immediate cooking, purees, or food service.',
    },
    {
      q: 'What is your Refund & Return policy?',
      a: 'If any produce arrives damaged, bruised, or unsatisfactory, you can request an instant return and refund directly from your Orders tab within 24 hours of delivery. Refunds are credited back to your original payment method (UPI/Card) within 24-48 hours.',
    },
    {
      q: 'How do "Farm Box" Recurring Subscriptions work?',
      a: 'Subscriptions let you schedule regular deliveries (Weekly, Bi-Weekly, or Monthly) on a fixed day. You receive an automatic 5% Subscribe & Save discount on every single order. You can pause, skip an upcoming delivery, or cancel anytime with zero cancellation fees.',
    },
    {
      q: 'Can I cancel an order after placing it?',
      a: 'Yes. You can cancel your order anytime while it is in the "Placed" or "Accepted" stage directly from your Order Tracking timeline. Reserved stock is immediately returned to inventory, and your payment is queued for instant refund.',
    },
  ];

  const handleSubmitInquiry = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmittedTicket(`TICK-${Date.now().toString().slice(-6)}`);
      setSubmitting(false);
      setMessage('');
      setOrderRef('');
    }, 800);
  };

  const handleReset = () => {
    setSubmittedTicket(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 my-6">
        {/* Header */}
        <div className="bg-emerald-800 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💬</span>
            <div>
              <h3 className="font-bold text-base">Consumer Help & Support Center</h3>
              <p className="text-emerald-200 text-xs mt-0.5">Frequently asked questions & 24/7 customer care</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-white/80 hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Quick Contact Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">📞</span>
              <div>
                <p className="font-bold text-emerald-950">Toll-Free Helpline</p>
                <p className="text-emerald-700 font-medium">1800-FARMFRESH</p>
                <p className="text-[10px] text-gray-500">Mon-Sun: 7 AM - 9 PM</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-2xl">✉️</span>
              <div>
                <p className="font-bold text-emerald-950">Email Support</p>
                <p className="text-emerald-700 font-medium">support@farmfresh.local</p>
                <p className="text-[10px] text-gray-500">Replies within 2 hours</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🛡️</span>
              <div>
                <p className="font-bold text-emerald-950">Freshness Promise</p>
                <p className="text-emerald-700 font-medium">100% Replacement</p>
                <p className="text-[10px] text-gray-500">No questions asked</p>
              </div>
            </div>
          </div>

          {/* FAQs Accordion */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
              <span>📖</span> Frequently Asked Questions
            </h4>
            <div className="space-y-2">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-xl overflow-hidden transition"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-xs font-semibold text-gray-800 transition"
                  >
                    <span>{faq.q}</span>
                    <span className="text-gray-400 font-bold ml-2">
                      {activeFaq === idx ? '−' : '+'}
                    </span>
                  </button>
                  {activeFaq === idx && (
                    <div className="px-4 py-3 bg-white text-xs text-gray-600 leading-relaxed border-t border-gray-100 animate-fade-in">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Support Ticket Submission Form */}
          <div className="border-t border-gray-200 pt-5">
            <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
              <span>✉️</span> Submit a Support Request or Dispute
            </h4>
            <p className="text-xs text-gray-500 mb-4">
              Need assistance with an existing order or have a question for our team? Send a note below.
            </p>

            {submittedTicket ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center text-xs">
                <span className="text-3xl block mb-2">🎉</span>
                <p className="font-bold text-emerald-900 text-sm">Inquiry Logged Successfully!</p>
                <p className="text-emerald-700 mt-1">
                  Ticket Reference: <span className="font-mono font-bold">{submittedTicket}</span>
                </p>
                <p className="text-gray-600 mt-1 text-[11px]">
                  Our customer happiness manager has been assigned to your query and will contact you via email shortly.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmittedTicket(null)}
                  className="mt-3 bg-emerald-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg hover:bg-emerald-800 transition"
                >
                  Submit Another Query
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitInquiry} className="space-y-3">
                <div className="p-2.5 bg-gray-50 rounded-lg text-[11px] text-gray-600 flex items-center justify-between border border-gray-100">
                  <span>Logged in as: <strong className="text-gray-800">{user?.name || 'Customer'}</strong></span>
                  <span className="font-mono text-gray-500">{user?.email || ''}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                      Issue Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-600"
                    >
                      <option value="Quality / Spoiled Produce">Quality / Damaged Produce</option>
                      <option value="Delivery Delay">Delivery Delay / Slot Issue</option>
                      <option value="Missing Items">Missing Items in Package</option>
                      <option value="Billing & Refund">Billing, Coupon or Refund Status</option>
                      <option value="Subscription Inquiry">Farm Box Subscription Inquiry</option>
                      <option value="Other">General Feedback / Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                      Order Reference # (Optional)
                    </label>
                    <input
                      type="text"
                      value={orderRef}
                      onChange={(e) => setOrderRef(e.target.value)}
                      placeholder="e.g. 65f... or INV-..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-600 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1">
                    Describe your issue / question *
                  </label>
                  <textarea
                    rows="3"
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide details about the issue so we can resolve it promptly..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold px-5 py-2 rounded-lg transition shadow-sm"
                  >
                    {submitting ? 'Submitting...' : 'Submit Support Ticket →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 text-right">
          <button
            onClick={handleReset}
            className="text-xs text-gray-600 hover:text-gray-900 font-medium px-4 py-1.5 rounded-lg hover:bg-gray-200/60 transition"
          >
            Close Help Center
          </button>
        </div>
      </div>
    </div>
  );
}
