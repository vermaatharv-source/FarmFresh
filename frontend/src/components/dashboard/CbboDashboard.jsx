import React, { useEffect, useState } from 'react';
import API from '../../api/axios';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const kg = (n) => `${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`;

export default function CbboDashboard() {
  const [data, setData] = useState(null);
  const [recon, setRecon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [a, r] = await Promise.all([API.get('/fpo-operations/admin/cbbo'), API.get('/fpo-operations/admin/reconciliation')]);
      setData(a.data); setRecon(r.data);
    } catch (e) { setError(e.response?.data?.message || 'Failed to load CBBO intelligence.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  if (loading) return <div className="bg-white border rounded-xl p-8 text-center text-slate-500">Loading CBBO dashboard…</div>;
  return <section className="space-y-5">
    {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
    <div className="rounded-2xl bg-slate-900 text-white p-6 flex flex-wrap justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-slate-400">CBBO / Multi-FPO Intelligence</p><h2 className="text-2xl font-bold mt-1">FPO Network Command Center</h2><p className="text-sm text-slate-300 mt-1">Portfolio-level operational visibility across registered FPOs.</p></div><button onClick={load} className="bg-white text-slate-900 rounded-lg px-4 py-2 text-sm font-semibold">Refresh</button></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">{[['FPOs',data?.totals?.fpos],['Farmers',data?.totals?.farmers],['Produce',kg(data?.totals?.produceKg)],['Inventory',kg(data?.totals?.inventoryKg)],['FPO sales',money(data?.totals?.sales)],['Paid farmers',money(data?.totals?.paidToFarmers)]].map(([l,v])=><div key={l} className="bg-white border rounded-xl p-4"><p className="text-[11px] uppercase text-slate-500">{l}</p><p className="text-xl font-bold mt-1">{v || 0}</p></div>)}</div>
    <div className="bg-white border rounded-xl overflow-hidden"><div className="px-5 py-4 border-b"><h3 className="font-semibold">FPO network</h3></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">FPO</th><th className="p-3 text-left">CBBO</th><th className="p-3 text-left">Location</th><th className="p-3 text-left">Farmers</th><th className="p-3 text-left">Produce</th><th className="p-3 text-left">Sales</th><th className="p-3 text-left">KYC</th></tr></thead><tbody>{(data?.fpos||[]).map(x=><tr key={x.fpoId} className="border-b"><td className="p-3 font-medium">{x.name}</td><td className="p-3">{x.cbboName}</td><td className="p-3">{[x.district,x.state].filter(Boolean).join(', ')||'—'}</td><td className="p-3">{x.farmers}</td><td className="p-3">{kg(x.produceKg)}</td><td className="p-3">{money(x.sales)}</td><td className="p-3">{x.kycStatus}</td></tr>)}{!(data?.fpos||[]).length&&<tr><td colSpan="7" className="p-8 text-center text-slate-400">No FPO records.</td></tr>}</tbody></table></div></div>
    <div className="bg-white border rounded-xl p-5"><h3 className="font-semibold">Network reconciliation</h3><p className="text-sm text-slate-500 mt-1">FPOs with inventory discrepancies are listed for review.</p><div className="mt-4 space-y-2">{(recon?.issues||[]).map(x=><div key={x.fpoId} className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800"><b>{x.name}</b> · {x.inventoryIssues} inventory issue(s)</div>)}{!(recon?.issues||[]).length&&<div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">No inventory reconciliation issues detected.</div>}</div></div>
  </section>;
}
