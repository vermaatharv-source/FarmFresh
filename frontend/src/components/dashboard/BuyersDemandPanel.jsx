import { useEffect, useState } from 'react';
import API from '../../api/axios';

const TYPE_LABEL = {
  INDIVIDUAL: 'Households',
  RESTAURANT: 'Restaurants',
  KIRANA: 'Kirana stores',
  WHOLESALER: 'Wholesalers',
};

const SIGNAL_STYLE = {
  HIGH: 'bg-emerald-100 text-emerald-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  LOW: 'bg-slate-100 text-slate-600',
};

const TREND = { UP: { icon: '▲', cls: 'text-emerald-600' }, DOWN: { icon: '▼', cls: 'text-rose-500' }, FLAT: { icon: '–', cls: 'text-slate-400' } };

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function Stat({ label, value, hint }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function BuyersDemandPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get('/growth/fpo/buyers-demand')
      .then((res) => setData(res.data.data))
      .catch((e) => setError(e.response?.data?.message || 'Could not load buyer data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  if (error) return <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</p>;
  if (!data) return null;

  const { summary, byBuyerType, topProduce, weekly, notListed } = data;
  const maxWeek = Math.max(1, ...weekly.map((w) => w.orders));
  const maxType = Math.max(1, ...byBuyerType.map((b) => b.orders));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Buyers & Demand</h2>
        <p className="text-sm text-slate-500">Who is buying from your FPO and what is selling, last 30 days.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Active buyers" value={summary.buyers30} hint={`${summary.newBuyers} new this month`} />
        <Stat label="Repeat buyers" value={`${summary.repeatRate}%`} hint={`${summary.repeatBuyers} ordered more than once`} />
        <Stat label="Orders" value={summary.orders30} hint={inr(summary.revenue30)} />
        <Stat label="Came via referral" value={summary.referredBuyers} hint="Buyers invited by other users" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Orders per week</h3>
          <div className="flex items-end gap-2 h-32">
            {weekly.map((w, i) => (
              <div key={w.week} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[10px] text-slate-500">{w.orders || ''}</span>
                <div
                  className={`w-full rounded-t ${i === weekly.length - 1 ? 'bg-emerald-600' : 'bg-emerald-200'}`}
                  style={{ height: `${Math.max(4, (w.orders / maxWeek) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Oldest week on the left, this week on the right.</p>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Who buys from you</h3>
          {byBuyerType.length === 0 ? (
            <p className="text-sm text-slate-500">No orders in the last 30 days yet.</p>
          ) : (
            <div className="space-y-3">
              {byBuyerType.map((b) => (
                <div key={b.type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{TYPE_LABEL[b.type] || b.type}</span>
                    <span className="text-slate-500">
                      {b.orders} orders · {b.qtyKg} kg · {inr(b.revenue)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(b.orders / maxType) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-900 p-4 pb-3">What is selling</h3>
        {topProduce.length === 0 ? (
          <p className="text-sm text-slate-500 px-4 pb-4">Sales will show here after your first orders.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Produce</th>
                  <th className="text-right font-medium px-4 py-2">Orders</th>
                  <th className="text-right font-medium px-4 py-2">Quantity</th>
                  <th className="text-right font-medium px-4 py-2">Revenue</th>
                  <th className="text-right font-medium px-4 py-2">This week</th>
                  <th className="text-right font-medium px-4 py-2">Demand</th>
                </tr>
              </thead>
              <tbody>
                {topProduce.map((p) => (
                  <tr key={p.produceType} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.produceType}</td>
                    <td className="px-4 py-2.5 text-right">{p.orders}</td>
                    <td className="px-4 py-2.5 text-right">{p.qtyKg} kg</td>
                    <td className="px-4 py-2.5 text-right">{inr(p.revenue)}</td>
                    <td className={`px-4 py-2.5 text-right text-xs font-semibold ${TREND[p.trend].cls}`}>{TREND[p.trend].icon}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SIGNAL_STYLE[p.signal]}`}>{p.signal}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {notListed.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-900">Selling on FarmFresh, not in your listings</h3>
          <p className="text-xs text-amber-800 mb-3">Orders across the platform in the last 7 days. Consider listing these.</p>
          <div className="flex flex-wrap gap-2">
            {notListed.map((p) => (
              <span key={p.produceType} className="bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs text-amber-900">
                <b>{p.produceType}</b> · {p.orders} orders · {p.qtyKg} kg
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
