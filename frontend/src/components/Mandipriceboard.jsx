import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import API from '../api/axios';

/**
 * Search is language-aware (canonical-English strategy):
 *   - Stored commodity/state names are always English (from Agmarknet).
 *   - When UI language is not English, translate the query → English, then filter.
 */
export default function MandiPriceBoard({ prices = [], loading, syncing, onSync, isAdmin }) {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [englishQuery, setEnglishQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setEnglishQuery('');
      setResolving(false);
      return;
    }

    if (language === 'en') {
      setEnglishQuery(q.toLowerCase());
      setResolving(false);
      return;
    }

    clearTimeout(debounceRef.current);
    const myId = ++requestIdRef.current;
    setResolving(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await API.post('/translate', {
          texts: [q],
          sourceLanguage: language,
          targetLanguage: 'en',
        });
        if (requestIdRef.current !== myId) return;
        const en = (data.translations?.[0] || q).trim().toLowerCase();
        setEnglishQuery(en);
      } catch (err) {
        console.error('[mandi search] translate failed:', err.message);
        if (requestIdRef.current === myId) {
          setEnglishQuery(q.toLowerCase());
        }
      } finally {
        if (requestIdRef.current === myId) setResolving(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [search, language]);

  const filtered = useMemo(() => {
    if (!englishQuery) return prices;
    return prices.filter(
      (p) =>
        p.commodityName?.toLowerCase().includes(englishQuery) ||
        p.state?.toLowerCase().includes(englishQuery) ||
        p.market?.toLowerCase().includes(englishQuery)
    );
  }, [prices, englishQuery]);

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
        data-no-translate
      />
      <p className="text-[11px] text-gray-400 -mt-1 mb-2">
        Min/Modal/Max are official Agmarknet rates per quintal (100kg); the ≈ ₹/kg column is the
        converted figure to compare against your grade pricing.
        {language !== 'en' && search.trim() && (
          <span className="block mt-0.5 text-slate-500">
            {resolving
              ? 'Translating search…'
              : englishQuery
                ? `Searching as: “${englishQuery}”`
                : null}
          </span>
        )}
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