import { useEffect, useMemo, useState } from 'react';
import API from '../../api/axios';
import { AreaChart, Delta, Donut, HBars, Icon, Pipeline, Ring, Sparkline } from './charts';
import { computeFpoMetrics } from './metrics';
import { greeting, inr, inr2, inrCompact, kgCompact, num, pct, timeAgo } from './format';

const GRADE_COLORS = { A: '#10b981', B: '#f59e0b', C: '#f43f5e' };

const Card = ({ title, subtitle, right, children, className = '' }) => (
  <section className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm ${className}`}>
    {(title || right) && (
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
);

function Kpi({ icon, label, value, sub, delta, spark, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
      <div className="absolute left-0 top-0 h-full w-1" style={{ background: color }} />
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
        <span className="rounded-md p-1.5" style={{ background: `${color}1f`, color }}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 leading-tight">{value}</p>
      <div className="mt-1 flex items-center gap-2 min-h-[18px]">
        {delta !== undefined && <Delta value={delta} />}
        <span className="text-xs text-slate-500">{sub}</span>
      </div>
      {spark && <div className="mt-2 -mb-1"><Sparkline data={spark} color={color} /></div>}
    </div>
  );
}

const levelStyle = {
  high: 'bg-rose-50 border-rose-200 text-rose-800',
  med: 'bg-amber-50 border-amber-200 text-amber-800',
  low: 'bg-slate-50 border-slate-200 text-slate-700',
};

export default function FpoOverview({
  profile,
  user,
  farmers = [],
  batches = [],
  inventory = [],
  payouts = [],
  listings = [],
  orders = [],
  logs = [],
  priceConfigs: priceConfigsProp,
  onNavigate = () => {},
}) {
  const [fetchedPrices, setFetchedPrices] = useState([]);
  const [series, setSeries] = useState('procurement');

  useEffect(() => {
    if (priceConfigsProp !== undefined) return;
    API.get('/grade-prices')
      .then((r) => setFetchedPrices(Array.isArray(r.data) ? r.data : []))
      .catch(() => setFetchedPrices([]));
  }, [priceConfigsProp]);
  const priceConfigs = priceConfigsProp !== undefined ? priceConfigsProp : fetchedPrices;

  const m = useMemo(
    () => computeFpoMetrics({ farmers, batches, inventory, payouts, listings, orders, logs, priceConfigs, profile }),
    [farmers, batches, inventory, payouts, listings, orders, logs, priceConfigs, profile]
  );

  const isAdmin = user && user.role === 'fpo_admin';
  const firstName = (user && user.name ? user.name : '').split(' ')[0];
  const kyc = profile && profile.kycStatus;

  return (
    <div className="space-y-5">
      {/* ---------- Hero ---------- */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-600 text-white p-6 shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-white/5" />
        <div className="absolute right-24 -bottom-16 h-44 w-44 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-[260px] flex-1">
            <p className="text-emerald-200 text-sm">{greeting()}{firstName ? `, ${firstName}` : ''}</p>
            <h2 className="text-2xl font-bold leading-snug mt-0.5">{profile && profile.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {profile && profile.registrationNumber && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 font-mono">{profile.registrationNumber}</span>
              )}
              {profile && profile.registrationType && (
                <span className="rounded-full bg-white/15 px-2.5 py-1">{profile.registrationType}</span>
              )}
              {kyc && (
                <span className={`rounded-full px-2.5 py-1 font-semibold ${kyc === 'Verified' ? 'bg-emerald-300 text-emerald-950' : kyc === 'Rejected' ? 'bg-rose-300 text-rose-950' : 'bg-amber-300 text-amber-950'}`}>
                  KYC {kyc}
                </span>
              )}
            </div>
            <p className="mt-4 text-sm text-emerald-50 max-w-xl">
              <b>{num(m.farmers.total)}</b> farmers, <b>{kgCompact(m.procurement.totalKg)}</b> procured across{' '}
              <b>{num(m.procurement.batchCount)}</b> traceable batches, <b>{inrCompact(m.sales.total)}</b> in sales and{' '}
              <b>{inrCompact(m.payouts.paid)}</b> paid to farmers.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[['Record intake', 'intake'], ['Add farmer', 'farmers'], ['View orders', 'orders'], ['Pay farmers', 'payouts']].map(([label, tab]) => (
                <button key={tab} onClick={() => onNavigate(tab)} className="rounded-lg bg-white/15 hover:bg-white/25 px-3.5 py-1.5 text-sm font-medium transition">
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Ring value={m.readiness.pct}>
              <span className="text-2xl font-bold leading-none">{m.readiness.done}/{m.readiness.total}</span>
              <span className="text-[10px] uppercase tracking-wide text-emerald-100 mt-1">ready</span>
            </Ring>
            <ul className="text-xs space-y-1 max-w-[210px]">
              {m.readiness.items.map((r) => (
                <li key={r.label}>
                  <button onClick={() => onNavigate(r.tab)} className="flex items-center gap-2 text-left hover:text-white text-emerald-100">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full ${r.done ? 'bg-emerald-300 text-emerald-950' : 'border border-white/40'}`}>
                      {r.done && <Icon name="check" className="h-3 w-3" />}
                    </span>
                    <span className={r.done ? '' : 'opacity-80'}>{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ---------- KPIs ---------- */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(172px, 1fr))' }}>
        <Kpi icon="users" color="#059669" label="Member farmers" value={num(m.farmers.total)}
          sub={m.farmers.womenPct !== null ? `${pct(m.farmers.womenPct)} women` : `${m.farmers.active} active`} />
        <Kpi icon="box" color="#0d9488" label="Procured (30 days)" value={kgCompact(m.procurement.kg30)}
          delta={m.procurement.change} sub="vs previous 30 days" spark={m.procurement.series.map((d) => d.value)} />
        <Kpi icon="trend" color="#2563eb" label="Sales (30 days)" value={inrCompact(m.sales.value30)}
          delta={m.sales.change} sub={`${num(m.sales.orderCount)} orders in total`} spark={m.sales.series.map((d) => d.value)} />
        <Kpi icon="cash" color="#7c3aed" label="Paid to farmers" value={inrCompact(m.payouts.paid)}
          sub={`${num(m.payouts.paidCount)} payouts`} spark={m.payouts.series.map((d) => d.value)} />
        <Kpi icon="clock" color="#d97706" label="Owed to farmers" value={inrCompact(m.payouts.pending)}
          sub={`${num(m.payouts.pendingCount)} graded batches unpaid`} />
      </div>

      {/* ---------- Trend + quality ---------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Last 30 days"
          subtitle="Move your pointer over the chart for daily values"
          right={
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
              {[['procurement', 'Procurement'], ['sales', 'Sales']].map(([k, label]) => (
                <button key={k} onClick={() => setSeries(k)} className={`rounded-md px-3 py-1 font-medium transition ${series === k ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                  {label}
                </button>
              ))}
            </div>
          }
        >
          {series === 'procurement' ? (
            <AreaChart data={m.procurement.series} color="#059669" formatY={(v) => (v >= 1000 ? `${v / 1000}t` : `${Math.round(v)}kg`)} formatTip={(v) => kgCompact(v)} />
          ) : (
            <AreaChart data={m.sales.series} color="#2563eb" formatY={(v) => inrCompact(v).replace('.0', '')} formatTip={(v) => inr(v)} />
          )}
        </Card>

        <Card title="Quality mix" subtitle={m.grades.gradedBatches ? `From ${m.grades.gradedBatches} graded batches` : 'Grade a batch to see quality'}>
          {m.grades.total > 0 ? (
            <Donut
              segments={['A', 'B', 'C'].map((g) => ({ label: `Grade ${g}`, value: m.grades[g], color: GRADE_COLORS[g] }))}
              centerTop={pct(m.grades.aPct)}
              centerBottom="Grade A"
              format={kgCompact}
            />
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">No graded produce yet.</p>
          )}
          {m.grades.total > 0 && (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              Every grade is saved with the officer's name and time. Farmers are paid by grade.
            </p>
          )}
        </Card>
      </div>

      {/* ---------- Produce, pipeline, payouts ---------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Top produce by volume" subtitle="All time, kilograms">
          <HBars items={m.topProduce} format={kgCompact} color="#059669" empty="Record an intake to see this." />
        </Card>
        <Card title="Order pipeline" subtitle={m.sales.exceptions ? `${m.sales.exceptions} cancelled, rejected or refunded` : 'From placed to delivered'}>
          {orders.length ? <Pipeline stages={m.sales.pipeline} color="#2563eb" /> : <p className="py-10 text-center text-sm text-slate-400">No consumer orders yet.</p>}
        </Card>
        <Card title="Farmer payments" subtitle="Paid and still owed">
          <Donut
            size={132}
            thickness={20}
            segments={[{ label: 'Paid', value: m.payouts.paid, color: '#7c3aed' }, { label: 'Owed', value: m.payouts.pending, color: '#fbbf24' }]}
            centerTop={m.payouts.sharePct !== null ? pct(m.payouts.sharePct) : '-'}
            centerBottom="of sales"
            format={inrCompact}
          />
          <p className="mt-3 text-xs text-slate-500">"Of sales" compares total farmer payouts with consumer sales value to date.</p>
        </Card>
      </div>

      {/* ---------- Pricing + attention ---------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Fair price vs mandi"
          subtitle="Published grade prices next to the latest market reference"
          right={
            <button onClick={() => onNavigate('completion')} className="text-xs font-medium text-emerald-700 hover:underline">
              Manage pricing
            </button>
          }
        >
          {m.pricing.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="py-2 font-medium">Crop</th>
                    <th className="py-2 font-medium text-right">Grade A</th>
                    <th className="py-2 font-medium text-right">Grade B</th>
                    <th className="py-2 font-medium text-right">Grade C</th>
                    <th className="py-2 font-medium text-right">Mandi ref.</th>
                    <th className="py-2 font-medium text-right">A vs mandi</th>
                    <th className="py-2 font-medium pl-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {m.pricing.map((p) => (
                    <tr key={p.crop} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 font-medium text-slate-900">{p.crop}</td>
                      <td className="py-2.5 text-right">{inr2(p.A)}</td>
                      <td className="py-2.5 text-right">{inr2(p.B)}</td>
                      <td className="py-2.5 text-right">{inr2(p.C)}</td>
                      <td className="py-2.5 text-right text-slate-600">{p.ref ? inr2(p.ref) : '-'}</td>
                      <td className="py-2.5 text-right">
                        {p.vsRef === null ? '-' : (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.vsRef >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {p.vsRef >= 0 ? '+' : ''}{p.vsRef.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.auto ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {p.auto ? 'Auto from mandi' : 'Manual'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">No grade prices configured yet.</p>
          )}
        </Card>

        <Card title="Needs your attention" subtitle={m.attention.length ? `${m.attention.length} open item${m.attention.length > 1 ? 's' : ''}` : 'All clear'}>
          {m.attention.length ? (
            <ul className="space-y-2">
              {m.attention.map((a, i) => (
                <li key={i} className={`flex items-start gap-3 rounded-lg border p-3 text-xs ${levelStyle[a.level]}`}>
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="flex-1">{a.text}</span>
                  <button onClick={() => onNavigate(a.tab)} className="whitespace-nowrap font-semibold underline">{a.label}</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center py-8 text-emerald-700">
              <Icon name="check" className="h-9 w-9" />
              <p className="mt-2 text-sm font-medium">Nothing needs attention</p>
            </div>
          )}
        </Card>
      </div>

      {/* ---------- Stock + activity + trust ---------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Stock on hand" subtitle={`${kgCompact(m.stock.totalKg)} in total`}>
          <HBars
            items={m.stock.byCrop.map((s) => ({ ...s, color: s.low ? '#f43f5e' : '#0d9488', note: s.low ? 'low' : '' }))}
            format={kgCompact}
            empty="No stock recorded yet."
          />
        </Card>

        <Card title="Recent activity" subtitle="Who did what, from the audit log">
          {isAdmin && m.activity.length ? (
            <ul className="space-y-3">
              {m.activity.slice(0, 6).map((a, i) => (
                <li key={a._id || i} className="flex gap-3 text-xs">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800 leading-snug">{a.summary || a.action}</p>
                    <p className="text-slate-400">{a.actorName || a.actorRole} &middot; {timeAgo(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">{isAdmin ? 'No activity recorded yet.' : 'The audit log is visible to the FPO administrator.'}</p>
          )}
        </Card>

        <Card title="Trust and data protection" subtitle="What protects your farmers' data">
          <ul className="space-y-2 text-xs text-slate-700">
            {[
              'Aadhaar is kept as the last four digits only',
              'Bank numbers are encrypted and shown masked',
              'KYC documents are private, seen only by you and the authority',
              `Every action is logged${m.auditWeek ? ` (${m.auditWeek} in the last 7 days)` : ''}`,
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-600"><Icon name="shield" className="h-4 w-4" /></span>
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-emerald-50 p-3">
            <div className="flex items-center gap-3">
              <span className="text-emerald-700"><Icon name="qr" className="h-7 w-7" /></span>
              <div>
                <p className="text-sm font-semibold text-emerald-900">{num(m.traced.batches)} batches traceable</p>
                <p className="text-[11px] text-emerald-800">Each has a public QR produce passport</p>
              </div>
            </div>
            {m.traced.latestBatchId && (
              <a href={`/trace/${m.traced.latestBatchId}`} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">
                Open latest
              </a>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
