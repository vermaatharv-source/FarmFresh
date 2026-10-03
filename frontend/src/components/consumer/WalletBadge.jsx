import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

export default function WalletBadge({ onClick }) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    api
      .get('/growth/wallet')
      .then((res) => setBalance(res.data.data.balance))
      .catch(() => setBalance(0));
  }, []);

  if (balance === null) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-white text-emerald-800 rounded-lg text-xs sm:text-sm font-semibold border border-slate-200 hover:bg-slate-50 transition"
    >
      <span className="text-base">₹</span>
      <span>{balance.toFixed(0)}</span>
      <span className="hidden sm:inline text-xs font-normal text-slate-500">credit</span>
    </button>
  );
}
