import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';

/**
 * Small header button "Invite" – opens a compact popover with the referral code,
 * Copy and WhatsApp share.
 */
export default function ReferralButton() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    api
      .get('/growth/referral/me')
      .then((res) => setData(res.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!data?.referralCode) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const whatsapp = () => {
    const text = encodeURIComponent(
      `Join FarmFresh and get ₹50 off your first order of farm-fresh produce!\nUse my code: ${data.referralCode}\n${data.shareLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Invite friends & earn ₹50"
        className="text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border transition border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
      >
        <span>🎁</span>
        <span className="hidden md:inline">Invite</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-emerald-100 rounded-xl shadow-xl p-3 z-[300]">
          <p className="text-sm font-semibold text-gray-900">Invite & earn</p>
          <p className="text-xs text-gray-500 mb-2">You both get ₹50 store credit</p>
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-2">
            <span className="font-mono font-bold tracking-wider text-emerald-800">{data.referralCode}</span>
            <button onClick={copy} className="text-xs font-semibold text-emerald-700 hover:underline">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={whatsapp}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-lg transition"
          >
            Share on WhatsApp
          </button>
          <p className="text-[11px] text-gray-500 mt-2">
            Earned ₹{data.totalEarned || 0} · Signed up {data.stats?.SIGNED_UP || 0} · Rewarded{' '}
            {data.stats?.REWARDED || 0}
          </p>
        </div>
      )}
    </div>
  );
}
