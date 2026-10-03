import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

/**
 * Referral Card – shown on Consumer Dashboard
 * Highest impact acquisition tool
 */
export default function ReferralCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get('/growth/referral/me')
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const copyCode = () => {
    if (!data?.referralCode) return;
    navigator.clipboard.writeText(data.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    if (!data?.shareLink) return;
    const text = encodeURIComponent(
      `Join FarmFresh and get ₹50 off your first order of farm-fresh produce!\nUse my code: ${data.referralCode}\n${data.shareLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100 animate-pulse h-40" />
    );
  }

  if (!data) return null;

  return (
    <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg">Invite Friends & Earn</h3>
            <p className="text-green-100 text-sm">You both get ₹50 store credit</p>
          </div>
          <div className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm font-semibold">
            Earned ₹{data.totalEarned || 0}
          </div>
        </div>

        <div className="bg-white/15 backdrop-blur rounded-xl p-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-green-100 mb-0.5">Your code</p>
            <p className="text-2xl font-mono font-bold tracking-wider">{data.referralCode}</p>
          </div>
          <button
            onClick={copyCode}
            className="bg-white text-green-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-50 transition"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={shareWhatsApp}
            className="flex-1 bg-white text-green-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-50 transition flex items-center justify-center gap-2"
          >
            <span>Share on WhatsApp</span>
          </button>
        </div>

        {data.stats && (
          <div className="mt-3 flex gap-4 text-xs text-green-100">
            <span>Signed up: {data.stats.SIGNED_UP || 0}</span>
            <span>Rewarded: {data.stats.REWARDED || 0}</span>
          </div>
        )}
      </div>
    </div>
  );
}
