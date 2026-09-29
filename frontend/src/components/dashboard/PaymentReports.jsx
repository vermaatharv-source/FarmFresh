import React from 'react';

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;
const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const Stat = ({ label, value, sub }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
    <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
);

export function FpoPaymentReport({ data, loading, error }) {
  const totals = data?.totals || {};
  const transactions = data?.transactions || [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Marketplace Earnings</h3>
        <p className="text-sm text-slate-500 mt-1">
          Recorded marketplace transactions attributed to this FPO. This is the internal transaction ledger, not a live payment-gateway settlement.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}
      {loading ? (
        <div className="bg-white border rounded-xl p-8 text-center text-slate-500">Loading earnings…</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="FPO earnings" value={money(totals.fpoAmount)} sub="Recorded FPO share" />
            <Stat label="Platform fee" value={money(totals.platformFee)} sub="Recorded platform fee" />
            <Stat label="Successful transactions" value={totals.count || 0} sub="Successful marketplace transactions" />
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h4 className="font-semibold text-sm text-slate-900">Recent transactions</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3">Transaction ID</th>
                    <th className="text-left px-4 py-3">Order</th>
                    <th className="text-left px-4 py-3">Order amount</th>
                    <th className="text-left px-4 py-3">FPO amount</th>
                    <th className="text-left px-4 py-3">Platform fee</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t._id || t.transactionId} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{t.transactionId || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{t.order || '—'}</td>
                      <td className="px-4 py-3">{money(t.orderAmount)}</td>
                      <td className="px-4 py-3 font-medium">{money(t.fpoAmount)}</td>
                      <td className="px-4 py-3">{money(t.platformFee)}</td>
                      <td className="px-4 py-3">{t.status || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{dateTime(t.createdAt)}</td>
                    </tr>
                  ))}
                  {!transactions.length && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No marketplace payment transactions recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AdminPaymentReport({ data, loading, error }) {
  const totals = data?.totals || {};
  const recent = data?.recent || [];

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-base font-semibold text-emerald-950">Platform Revenue</h2>
        <p className="text-sm text-emerald-800 mt-1">
          Platform-wide marketplace transaction ledger. This shows recorded fee allocation; it is not a live payment-gateway settlement report.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}
      {loading ? (
        <div className="bg-white border rounded-xl p-8 text-center text-slate-500">Loading platform revenue…</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Order value" value={money(totals.orderAmount)} sub="Successful transactions" />
            <Stat label="Platform revenue" value={money(totals.platformFee)} sub="Recorded platform fees" />
            <Stat label="FPO allocation" value={money(totals.fpoAmount)} sub="Recorded FPO share" />
            <Stat label="Transactions" value={totals.count || 0} sub="Successful transactions" />
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold text-sm text-slate-900">Recent payment transactions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3">Transaction ID</th>
                    <th className="text-left px-4 py-3">FPO</th>
                    <th className="text-left px-4 py-3">Order amount</th>
                    <th className="text-left px-4 py-3">Platform fee</th>
                    <th className="text-left px-4 py-3">FPO amount</th>
                    <th className="text-left px-4 py-3">Total charged</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t._id || t.transactionId} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{t.transactionId || '—'}</td>
                      <td className="px-4 py-3">{t.fpo?.name || '—'}</td>
                      <td className="px-4 py-3">{money(t.orderAmount)}</td>
                      <td className="px-4 py-3 font-medium">{money(t.platformFee)}</td>
                      <td className="px-4 py-3">{money(t.fpoAmount)}</td>
                      <td className="px-4 py-3">{money(t.totalCharged)}</td>
                      <td className="px-4 py-3">{t.status || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{dateTime(t.createdAt)}</td>
                    </tr>
                  ))}
                  {!recent.length && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No payment transactions recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
