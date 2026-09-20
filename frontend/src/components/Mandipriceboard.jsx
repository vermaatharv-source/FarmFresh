import { useMemo, useState } from 'react';

// Presentational — the parent (FpoCompletionPanel) owns the data fetch so the
// same `prices` list can also be used to auto-fill the grade pricing form and
// to badge Active/Historical Prices against the live market rate.
export default function MandiPriceBoard({ prices = [], loading, syncing, onSync, isAdmin }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return prices;
    const q = search.trim().toLowerCase();
    return prices.filter(
      (p) => p.commodityName?.toLowerCase().includes(q) || p.state?.toLowerCase().includes(q)
    );
  }, [prices, search]);

  const lastSynced = useMemo(() => {
    if (!prices.length) return null;
    return prices.reduce((latest, p) => {
      const t = p.lastSyncedAt ? new Date(p.lastSyncedAt).getTime() : 0;
      return t > latest ? t : latest;
    }, 0);
  }, [prices]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="font-semibold">Live Mandi Market Prices</h3>
          <p className="text-xs text-gray-500">
            Synced from Agmarknet/eNAM
            {lastSynced ? ` · last synced ${new Date(lastSynced).toLocaleString()}` : ''}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="shrink-0 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
          >
            {syncing ? 'Syncing…' : '↻ Sync Now'}
          </button>
        )}
      </div>

      <input
        placeholder="Filter by crop or state…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 border rounded-lg text-sm my-3"
      />
      <p className="text-[11px] text-gray-400 -mt-1 mb-2">
        Min/Modal/Max are official Agmarknet rates per quintal (100kg); the ≈ ₹/kg column is the converted figure to compare against your grade pricing.
      </p>

      {loading && <p className="text-sm text-gray-400">Loading mandi prices…</p>}

      {!loading && !filtered.length && (
        <p className="text-sm text-gray-400">
          No live mandi data yet{isAdmin ? ' — try Sync Now.' : '.'}
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-1.5 pr-2">Commodity</th>
                <th className="py-1.5 pr-2">Market</th>
                <th className="py-1.5 pr-2 text-right">Min/qtl</th>
                <th className="py-1.5 pr-2 text-right">Modal/qtl</th>
                <th className="py-1.5 pr-2 text-right">Max/qtl</th>
                <th className="py-1.5 pr-2 text-right">≈ ₹/kg</th>
                <th className="py-1.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={`${p.commodityName}-${p.state}-${p._id}`} className="border-b last:border-0">
                  <td className="py-1.5 pr-2 font-medium">{p.commodityName}</td>
                  <td className="py-1.5 pr-2 text-gray-500">
                    {p.market ? `${p.market}, ` : ''}
                    {p.state || '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-right">₹{p.minPrice ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-right">₹{p.modalPrice ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-right">₹{p.maxPrice ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-right font-semibold">
                    {p.modalPrice != null ? `₹${Math.round((p.modalPrice / 100) * 100) / 100}` : '—'}
                  </td>
                  <td className="py-1.5 text-right text-gray-400">
                    {p.date ? new Date(p.date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}