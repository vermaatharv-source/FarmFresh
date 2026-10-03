import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../../api/axios';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyRound = (value) => `₹${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
const dateTime = (value) => value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const shortDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const Stat = ({ label, value, sub }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
    <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
);

/* ------------------------------------------------------------------ */
/* Helpers for the bank-ready pack (CSV + printable report)            */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Indian financial year runs 1 April to 31 March.
function periodRange(preset, now = new Date()) {
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  if (preset === 'last-fy') return { from: `${fyStartYear - 1}-04-01`, to: `${fyStartYear}-03-31` };
  if (preset === '6m') return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())), to: ymd(now) };
  if (preset === '12m') return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 12, now.getDate())), to: ymd(now) };
  return { from: `${fyStartYear}-04-01`, to: ymd(now) };
}

const PERIOD_OPTIONS = [
  { id: 'this-fy', label: 'This financial year (so far)' },
  { id: 'last-fy', label: 'Last financial year' },
  { id: '6m', label: 'Last 6 months' },
  { id: '12m', label: 'Last 12 months' },
  { id: 'custom', label: 'Custom dates' },
];

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Guards against spreadsheet formula injection and quotes the cell.
const csvCell = (value) => {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const slug = (s) => String(s || 'fpo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'fpo';

function buildLedgerCsv(pack) {
  const header = ['Date', 'Type', 'Reference', 'Details', 'Payment method', 'Funded from', 'Money in (INR)', 'Money out (INR)', 'Net movement (INR)'];
  const rows = pack.ledger.rows.map((r) => [r.date, r.type, r.reference, r.details, r.method, r.fundedFrom, r.inflow.toFixed(2), r.outflow.toFixed(2), r.net.toFixed(2)]);
  const totalIn = pack.ledger.rows.reduce((s, r) => s + r.inflow, 0);
  const totalOut = pack.ledger.rows.reduce((s, r) => s + r.outflow, 0);
  rows.push(['TOTAL', '', '', '', '', '', totalIn.toFixed(2), totalOut.toFixed(2), (totalIn - totalOut).toFixed(2)]);
  const body = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  return `\uFEFF${body}\r\n`;
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildReportHtml(pack) {
  const m = (v) => esc(moneyRound(v));
  const table = (head, rows, empty) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
      rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}" class="muted">${esc(empty)}</td></tr>`
    }</tbody></table>`;
  const f = pack.fpo;
  const where = [f.district, f.state].filter(Boolean).join(', ');
  const LEDGER_MAX = 150;
  const ledgerRows = pack.ledger.rows.slice(-LEDGER_MAX);
  const comp = pack.compliance.summary;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(f.name)} – Financial summary</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:24px;font-size:12px;line-height:1.45}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:22px 0 6px;border-bottom:2px solid #059669;padding-bottom:3px}
  .muted{color:#64748b} .box{border:1px solid #fcd34d;background:#fffbeb;padding:8px 10px;border-radius:6px;margin:12px 0}
  table{width:100%;border-collapse:collapse;margin-top:6px} th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#f1f5f9} td.n,th.n{text-align:right}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px} .k{border:1px solid #e2e8f0;border-radius:6px;padding:8px}
  .k b{display:block;font-size:15px;margin-top:2px} .foot{margin-top:24px;font-size:10px;color:#64748b}
  .btn{position:fixed;top:12px;right:12px;padding:8px 14px;background:#059669;color:#fff;border:0;border-radius:6px;font-weight:bold;cursor:pointer}
  @media print{.btn{display:none} body{margin:12mm}}
</style></head><body>
<button class="btn" onclick="window.print()">Print / Save as PDF</button>
<h1>${esc(f.name)}</h1>
<div class="muted">${esc([f.registrationType, f.registrationNumber && `Reg. no. ${f.registrationNumber}`, f.gstin && `GSTIN ${f.gstin}`].filter(Boolean).join(' · '))}</div>
<div class="muted">${esc([where, f.cbboName && `CBBO: ${f.cbboName}`, f.schemeName && `Scheme: ${f.schemeName}`].filter(Boolean).join(' · '))}</div>
<h2 style="border:0;margin-top:14px">Financial &amp; operations summary: ${esc(shortDate(pack.period.from))} to ${esc(shortDate(pack.period.to))}</h2>
<div class="muted">Generated ${esc(dateTime(pack.generatedAt))}</div>
<div class="box"><b>Please read:</b><br>${pack.disclaimer.map((d) => `• ${esc(d)}`).join('<br>')}</div>

<h2>Key figures for the period</h2>
<div class="grid">
  <div class="k">Marketplace receipts<b>${m(pack.sales.receipts)}</b></div>
  <div class="k">Refunds to buyers<b>${m(pack.sales.refunds)}</b></div>
  <div class="k">Net marketplace income<b>${m(pack.sales.net)}</b></div>
  <div class="k">Paid to farmers<b>${m(pack.payouts.total)}</b><span class="muted">${esc(pack.payouts.count)} payouts · ${esc(pack.payouts.farmersPaid)} farmers</span></div>
  <div class="k">Produce procured<b>${esc(Math.round(pack.procurement.intakeKg).toLocaleString('en-IN'))} kg</b><span class="muted">${esc(pack.procurement.batches)} batches · ${esc(pack.procurement.gradeAPct)}% Grade A</span></div>
  <div class="k">Members<b>${esc(pack.members.registered)}</b><span class="muted">${esc(pack.members.active)} active · ${esc(pack.members.shareholders)} shareholders (declared: ${esc(pack.fpo.declaredShareholders)})</span></div>
</div>

<h2>Month by month</h2>
${table(['Month', 'Receipts', 'Refunds', 'Paid to farmers', 'Net'], pack.monthly.map((x) => [esc(x.month), m(x.receipts), m(x.refunds), m(x.payouts), m(x.net)]), 'No activity in this period.')}

<h2>Produce procured</h2>
${table(['Produce', 'Batches', 'Intake (kg)', 'Grade A (kg)', 'Grade B (kg)', 'Grade C (kg)', 'Value at farmer price'], pack.procurement.byProduce.map((p) => [esc(p.produceType), esc(p.batches), esc(p.intakeKg), esc(p.gradeAKg), esc(p.gradeBKg), esc(p.gradeCKg), m(p.farmerValue)]), 'No produce procured in this period.')}

<h2>Farmer payments: how they were made</h2>
${table(['Method / source', 'Amount'], [...Object.entries(pack.payouts.byMethod).map(([k, v]) => [esc(`By ${k.replace('_', ' ').toLowerCase()}`), m(v)]), ...Object.entries(pack.payouts.byFunding).map(([k, v]) => [esc(`Funded from ${k === 'CREDIT_LINE' ? 'credit line' : 'FPO cash'}`), m(v)])], 'No farmer payouts in this period.')}

<h2>Position today (${esc(shortDate(String(pack.position.asOf).slice(0, 10)))})</h2>
${table(['Item', 'Amount'], [
    ['Owed to farmers (graded, unpaid)', m(pack.position.payablesTotal)],
    ['…of which owed for more than 30 days', m(pack.position.payablesOver30)],
    ['Cash on Delivery still to collect', m(pack.position.codToCollect)],
    ['Credit line limit', m(pack.position.creditLimit)],
    ['Credit line drawn', m(pack.position.creditDrawn)],
    ['Credit line headroom', m(pack.position.creditHeadroom)],
  ], '')}
${table(['Owed to farmers: age', 'Batches', 'Amount'], pack.position.buckets.map((b) => [esc(b.label), esc(b.count), m(b.amount)]), 'Nothing owed.')}

<h2>Compliance status (entered by the FPO)</h2>
<div>${esc(comp.completed)} completed · ${esc(comp.overdue)} overdue · ${esc(comp.dueSoon)} due within 30 days · ${esc(comp.noDate)} open with no date set (of ${esc(comp.total)} tasks)</div>
${table(['Open task', 'Category', 'Due', 'Status'], pack.compliance.open.map((t) => [esc(t.title), esc(t.category), esc(t.dueDate ? shortDate(String(t.dueDate).slice(0, 10)) : 'No date'), esc(t.isOverdue ? 'OVERDUE' : String(t.status).replace('_', ' '))]), 'No open tasks.')}

<h2>Cash ledger${pack.ledger.rows.length > LEDGER_MAX ? ` (latest ${LEDGER_MAX} of ${pack.ledger.totalRows} entries; the full ledger is in the CSV)` : ''}</h2>
${table(['Date', 'Type', 'Reference', 'Details', 'In', 'Out', 'Net'], ledgerRows.map((r) => [esc(r.date), esc(r.type), esc(r.reference), esc(r.details), r.inflow ? m(r.inflow) : '', r.outflow ? m(r.outflow) : '', m(r.net)]), 'No ledger entries in this period.')}
<p class="foot">Generated by FarmFresh. Farmer names are not shown; payees appear as member IDs. This is not an audited statement.</p>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Bank-ready pack card                                                */
/* ------------------------------------------------------------------ */

function BankPackSection() {
  const [preset, setPreset] = useState('this-fy');
  const [custom, setCustom] = useState(() => periodRange('this-fy'));
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const range = preset === 'custom' ? custom : periodRange(preset);

  const fetchPack = async () => {
    const res = await API.get('/payments/fpo/bank-pack', { params: { from: range.from, to: range.to } });
    return res.data;
  };

  const downloadCsv = async () => {
    setWorking('csv');
    setError('');
    setMessage('');
    try {
      const pack = await fetchPack();
      downloadText(`ledger_${slug(pack.fpo.name)}_${pack.period.from}_to_${pack.period.to}.csv`, buildLedgerCsv(pack), 'text/csv;charset=utf-8');
      setMessage(
        pack.ledger.rows.length
          ? `Downloaded ${pack.ledger.rows.length} ledger entries.${pack.ledger.truncated ? ' The ledger was cut at 5,000 rows; choose a shorter period for the rest.' : ''}`
          : 'There were no ledger entries in this period, so the file contains only headings.'
      );
    } catch (e) {
      setError(e.response?.data?.message || 'Could not build the ledger. Please try again.');
    } finally {
      setWorking('');
    }
  };

  const openReport = async () => {
    setError('');
    setMessage('');
    // The window must be opened inside the click, before the network call, or pop-up blockers stop it.
    const win = window.open('', '_blank');
    if (!win) {
      setError('Your browser blocked the report window. Allow pop-ups for this site and try again.');
      return;
    }
    win.document.write('<p style="font-family:Arial;padding:24px">Preparing your report…</p>');
    setWorking('pdf');
    try {
      const pack = await fetchPack();
      win.document.open();
      win.document.write(buildReportHtml(pack));
      win.document.close();
      win.focus();
      setMessage('Report opened in a new tab. Use "Print / Save as PDF" there.');
    } catch (e) {
      win.close();
      setError(e.response?.data?.message || 'Could not build the report. Please try again.');
    } finally {
      setWorking('');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div>
        <h4 className="font-semibold text-slate-900">Bank-ready data pack</h4>
        <p className="text-sm text-slate-500 mt-1">
          A clean ledger and summary you can hand to a bank, your CA or your CBBO. It uses only your FarmFresh records.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs font-medium text-slate-600">
          Period
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label className="block text-xs font-medium text-slate-600">
              From
              <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              To
              <input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </label>
          </>
        )}
        <button type="button" onClick={openReport} disabled={!!working || !range.from || !range.to} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
          {working === 'pdf' ? 'Preparing…' : 'Open printable report (PDF)'}
        </button>
        <button type="button" onClick={downloadCsv} disabled={!!working || !range.from || !range.to} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-800 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
          {working === 'csv' ? 'Preparing…' : 'Download ledger (CSV for Excel)'}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Period: {shortDate(range.from)} to {shortDate(range.to)}. Farmer names are left out; payees appear as member IDs. Figures are not audited and are not reconciled with bank statements, and the report says so.
      </p>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}
      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded text-sm">{message}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cash-flow section                                                   */
/* ------------------------------------------------------------------ */

const ALERT_STYLE = {
  danger: 'bg-red-50 border-red-200 text-red-800',
  warn: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-sky-50 border-sky-200 text-sky-900',
};

const COVER = {
  healthy: { label: 'Healthy', cls: 'bg-emerald-100 text-emerald-800' },
  tight: { label: 'Tight', cls: 'bg-amber-100 text-amber-800' },
  shortfall: { label: 'Shortfall', cls: 'bg-red-100 text-red-800' },
  clear: { label: 'Nothing owed', cls: 'bg-slate-100 text-slate-700' },
};

function DailyChart({ daily }) {
  const max = Math.max(1, ...daily.map((d) => Math.max(d.inflow, d.outflow)));
  const hasData = daily.some((d) => d.inflow > 0 || d.outflow > 0);
  if (!hasData) return <p className="text-sm text-slate-400 py-6 text-center">No money moved in the last 30 days.</p>;
  return (
    <div>
      <div className="flex items-end gap-[3px] h-36" role="img" aria-label="Daily money in and out for the last 30 days">
        {daily.map((d) => (
          <div key={d.date} className="flex-1 flex items-end justify-center gap-[1px] h-full" title={`${shortDate(d.date)}: in ${moneyRound(d.inflow)}, out ${moneyRound(d.outflow)}`}>
            <div className="w-1/2 bg-emerald-500 rounded-t-sm" style={{ height: `${(d.inflow / max) * 100}%`, minHeight: d.inflow > 0 ? 2 : 0 }} />
            <div className="w-1/2 bg-amber-500 rounded-t-sm" style={{ height: `${(d.outflow / max) * 100}%`, minHeight: d.outflow > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>{shortDate(daily[0].date)}</span>
        <span>{shortDate(daily[daily.length - 1].date)}</span>
      </div>
      <div className="flex gap-4 text-xs text-slate-600 mt-2">
        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Recorded receipts</span>
        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded-sm bg-amber-500" /> Farmer payouts + refunds</span>
      </div>
    </div>
  );
}

function CashFlowSection() {
  const [cf, setCf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bankCash, setBankCash] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/payments/fpo/cash-flow');
      setCf(res.data || null);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load cash flow.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const extra = Math.max(0, Number(bankCash) || 0);
  const proj = cf?.projection;
  const adjusted = useMemo(() => {
    if (!proj) return null;
    const available = proj.available + extra;
    if (!(proj.payables > 0)) return { available, coverage: null, status: 'clear', shortfall: 0 };
    const coverage = available / proj.payables;
    return { available, coverage, status: coverage < 1 ? 'shortfall' : coverage < 1.5 ? 'tight' : 'healthy', shortfall: Math.max(0, proj.payables - available) };
  }, [proj, extra]);

  if (loading && !cf) return <div className="bg-white border rounded-xl p-8 text-center text-slate-500">Loading cash flow…</div>;
  if (error && !cf) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm flex items-center justify-between gap-3">
        <span>{error}</span>
        <button type="button" onClick={load} className="font-semibold underline">Try again</button>
      </div>
    );
  }
  if (!cf) return null;

  const { summary: s, receivables: r, payables: p } = cf;
  const maxBucket = Math.max(1, ...p.buckets.map((b) => b.amount));
  const cover = COVER[adjusted.status];
  const barTotal = Math.max(adjusted.available, proj.payables, 1);
  const seg = (v) => `${Math.min(100, (v / barTotal) * 100)}%`;
  const usedPct = s.creditLimit > 0 ? Math.min(100, Math.round((s.creditDrawn / s.creditLimit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-base font-semibold text-slate-900">Cash flow &amp; working capital</h4>
          <p className="text-xs text-slate-500">Built from your marketplace orders, graded batches and farmer payouts. Updated {dateTime(cf.generatedAt)}.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50">
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

      {cf.alerts.length > 0 && (
        <div className="space-y-2">
          {cf.alerts.map((a, i) => (
            <div key={`${a.level}-${i}`} className={`border rounded-lg px-4 py-2.5 text-sm ${ALERT_STYLE[a.level] || ALERT_STYLE.info}`}>{a.text}</div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Marketplace earnings" value={moneyRound(s.netEarnings)} sub={`After ${moneyRound(s.refunds)} refunds`} />
        <Stat label="Paid to farmers" value={moneyRound(s.totalPaidToFarmers)} sub={`${moneyRound(s.cashPayouts)} cash · ${moneyRound(s.creditPayouts)} credit line`} />
        <Stat label="Net marketplace cash" value={moneyRound(s.netCash)} sub="Cash received minus payouts from FPO cash" />
        <Stat label="Owed to farmers" value={moneyRound(p.total)} sub={`${p.count} graded batch${p.count === 1 ? '' : 'es'} unpaid`} />
        <Stat label="Credit line headroom" value={moneyRound(s.creditHeadroom)} sub={s.creditLimit > 0 ? `${usedPct}% of ${moneyRound(s.creditLimit)} used` : 'No credit line set'} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="font-semibold text-sm text-slate-900">Can you pay your farmers? (cover check)</h4>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cover.cls}`}>{cover.label}</span>
          {adjusted.coverage !== null && <span className="text-xs text-slate-500">Cover: {adjusted.coverage.toFixed(2)}×</span>}
        </div>

        {proj.payables > 0 ? (
          <>
            <div>
              <div className="flex h-4 rounded-full overflow-hidden bg-slate-100" aria-hidden="true">
                <div className="bg-emerald-500" style={{ width: seg(proj.marketplaceCash) }} />
                <div className="bg-sky-500" style={{ width: seg(proj.codToCollect) }} />
                <div className="bg-violet-500" style={{ width: seg(proj.creditHeadroom) }} />
                <div className="bg-teal-600" style={{ width: seg(extra) }} />
              </div>
              <div className="relative h-3">
                <div className="absolute top-0 h-3 border-l-2 border-red-500" style={{ left: seg(proj.payables) }} title="Amount owed to farmers" />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 mr-1" />Marketplace cash {moneyRound(proj.marketplaceCash)}</span>
                <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-500 mr-1" />COD to collect {moneyRound(proj.codToCollect)}</span>
                <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-500 mr-1" />Unused credit line {moneyRound(proj.creditHeadroom)}</span>
                {extra > 0 && <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-teal-600 mr-1" />Your bank cash {moneyRound(extra)}</span>}
                <span className="text-red-600 font-semibold">| Owed to farmers {moneyRound(proj.payables)}</span>
              </div>
            </div>
            <p className="text-sm text-slate-700">
              Available funds <b>{moneyRound(adjusted.available)}</b> against <b>{moneyRound(proj.payables)}</b> owed.
              {adjusted.shortfall > 0 ? <> You are <b className="text-red-600">{moneyRound(adjusted.shortfall)}</b> short.</> : ' You can cover everything currently owed.'}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">No graded batches are waiting for payment right now.</p>
        )}

        <label className="block text-xs font-medium text-slate-600 max-w-xs">
          Cash in your bank account (optional, not saved)
          <input type="number" min="0" inputMode="decimal" value={bankCash} onChange={(e) => setBankCash(e.target.value)} placeholder="e.g. 50000" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <p className="text-xs text-slate-500">
          This check uses marketplace data only. It does not know your bank balance or other income, so add your bank cash above for a fuller picture.
        </p>
      </div>

      <div>
        <h4 className="font-semibold text-sm text-slate-900 mb-3">Money from orders</h4>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Delivered" value={moneyRound(r.settled)} sub="Confirmed earnings" />
          <Stat label="Paid online, not yet delivered" value={moneyRound(r.prepaidInTransit)} sub="Refundable if the order is cancelled" />
          <Stat label="Cash on Delivery to collect" value={moneyRound(r.codToCollect)} sub={`${r.activeCount} order${r.activeCount === 1 ? '' : 's'} in progress`} />
          <Stat label="Refunded" value={moneyRound(r.refunded)} sub="Returned to buyers" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h4 className="font-semibold text-sm text-slate-900">Owed to farmers, by age</h4>
          <p className="text-xs text-slate-500 mt-1">Counted from the day each batch was graded and approved.</p>
          <div className="mt-4 space-y-3">
            {p.buckets.map((b) => (
              <div key={b.key}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{b.label} · {b.count} batch{b.count === 1 ? '' : 'es'}</span>
                  <span className="font-semibold text-slate-800">{moneyRound(b.amount)}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={b.key === '31+' ? 'h-full bg-red-500' : b.key === '16-30' ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'} style={{ width: `${(b.amount / maxBucket) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b"><h4 className="font-semibold text-sm text-slate-900">Farmers owed the most</h4></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2.5">Farmer</th>
                  <th className="text-left px-4 py-2.5">Owed</th>
                  <th className="text-left px-4 py-2.5">Oldest</th>
                </tr>
              </thead>
              <tbody>
                {p.topFarmers.map((f) => (
                  <tr key={f.farmerId} className="border-b last:border-0">
                    <td className="px-4 py-2.5">{f.name}{f.village ? <span className="text-xs text-slate-400"> · {f.village}</span> : null}</td>
                    <td className="px-4 py-2.5 font-medium">{moneyRound(f.owed)}</td>
                    <td className={`px-4 py-2.5 whitespace-nowrap ${f.oldestDays > 30 ? 'text-red-600 font-semibold' : ''}`}>{f.oldestDays} day{f.oldestDays === 1 ? '' : 's'}</td>
                  </tr>
                ))}
                {!p.topFarmers.length && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No unpaid graded batches.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h4 className="font-semibold text-sm text-slate-900">Last 30 days</h4>
          <span className="text-xs text-slate-500">In {moneyRound(s.last30.in)} · Out {moneyRound(s.last30.out)}</span>
        </div>
        <DailyChart daily={cf.daily} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h4 className="font-semibold text-sm text-slate-900">Credit line usage</h4>
        <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className={usedPct >= 80 ? 'h-full bg-red-500' : 'h-full bg-amber-500'} style={{ width: `${usedPct}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {s.creditLimit > 0
            ? `${moneyRound(s.creditDrawn)} used of ${moneyRound(s.creditLimit)}. Payouts marked as funded from the credit line count as used.`
            : 'Set your credit line limit in Profile & KYC to track usage here.'}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function FpoPaymentReport({ data, loading, error }) {
  const totals = data?.totals || {};
  const transactions = data?.transactions || [];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Marketplace Earnings &amp; Cash Flow</h3>
        <p className="text-sm text-slate-500 mt-1">
          Your marketplace income, what you owe farmers, and how long you can keep paying them on time. Platform revenue is confidential and is not shown here.
        </p>
      </div>

      <CashFlowSection />

      <BankPackSection />

      <div className="space-y-4">
        <h4 className="text-base font-semibold text-slate-900">Marketplace transactions</h4>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}
        {loading ? (
          <div className="bg-white border rounded-xl p-8 text-center text-slate-500">Loading earnings…</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Stat label="FPO marketplace share" value={money(totals.fpoAmount)} sub="After refunds" />
              <Stat label="Recorded transactions" value={totals.count || 0} sub="Including refunded ones" />
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b"><h4 className="font-semibold text-sm text-slate-900">Recent FPO transactions</h4></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3">Transaction ID</th>
                      <th className="text-left px-4 py-3">Order</th>
                      <th className="text-left px-4 py-3">FPO amount</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t._id || t.transactionId} className="border-b last:border-0">
                        <td className="px-4 py-3 font-mono text-xs">{t.transactionId || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{t.order || '—'}</td>
                        <td className="px-4 py-3 font-medium">{money(t.fpoAmount)}</td>
                        <td className="px-4 py-3">{t.status || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{dateTime(t.createdAt)}</td>
                      </tr>
                    ))}
                    {!transactions.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No marketplace payment transactions recorded yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
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
        <p className="text-sm text-emerald-800 mt-1">Platform-wide marketplace transaction ledger. This admin-only view contains the confidential platform fee allocation.</p>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}
      {loading ? <div className="bg-white border rounded-xl p-8 text-center text-slate-500">Loading platform revenue…</div> : <>
        <div className="grid gap-4 md:grid-cols-4"><Stat label="Order value" value={money(totals.orderAmount)} sub="Successful transactions" /><Stat label="Platform revenue" value={money(totals.platformFee)} sub="Recorded platform fees" /><Stat label="FPO allocation" value={money(totals.fpoAmount)} sub="Recorded FPO share" /><Stat label="Transactions" value={totals.count || 0} sub="Successful transactions" /></div>
        <div className="bg-white border rounded-xl overflow-hidden"><div className="px-5 py-4 border-b"><h3 className="font-semibold text-sm text-slate-900">Recent payment transactions</h3></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 border-b text-slate-600"><tr><th className="text-left px-4 py-3">Transaction ID</th><th className="text-left px-4 py-3">FPO</th><th className="text-left px-4 py-3">Order amount</th><th className="text-left px-4 py-3">Platform fee</th><th className="text-left px-4 py-3">FPO amount</th><th className="text-left px-4 py-3">Total charged</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Date</th></tr></thead><tbody>{recent.map(t=><tr key={t._id||t.transactionId} className="border-b"><td className="px-4 py-3 font-mono text-xs">{t.transactionId||'—'}</td><td className="px-4 py-3">{t.fpo?.name||'—'}</td><td className="px-4 py-3">{money(t.orderAmount)}</td><td className="px-4 py-3 font-medium">{money(t.platformFee)}</td><td className="px-4 py-3">{money(t.fpoAmount)}</td><td className="px-4 py-3">{money(t.totalCharged)}</td><td className="px-4 py-3">{t.status||'—'}</td><td className="px-4 py-3 whitespace-nowrap">{dateTime(t.createdAt)}</td></tr>)}{!recent.length&&<tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No payment transactions recorded yet.</td></tr>}</tbody></table></div></div>
      </>}
    </section>
  );
}
