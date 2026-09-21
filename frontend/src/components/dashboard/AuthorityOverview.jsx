import { useMemo } from 'react';
import { Columns, Donut, HBars, Icon, Ring } from './charts';
import { computeAuthorityMetrics } from './metrics';
import { inrCompact, kgCompact, num, pct } from './format';

const Card = ({ title, subtitle, children, className = '' }) => (
  <section className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm ${className}`}>
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const Stat = ({ icon, label, value, sub, color }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
    <div className="absolute left-0 top-0 h-full w-1" style={{ background: color }} />
    <div className="flex items-center justify-between">
      <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
      <span className="rounded-md p-1.5" style={{ background: `${color}1f`, color }}><Icon name={icon} className="h-4 w-4" /></span>
    </div>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-xs text-slate-500 mt-0.5 min-h-[16px]">{sub}</p>
  </div>
);

/**
 * Government overview: the FPO registry at a glance plus platform-wide impact
 * numbers. Contains only counts and totals. No farmer personal data.
 */
export default function AuthorityOverview({ fpos = [], summary = null, onReview = () => {} }) {
  const a = useMemo(() => computeAuthorityMetrics(fpos), [fpos]);
  const s = summary;
  const womenPct = s && s.farmers.genderRecorded ? (s.farmers.women / s.farmers.genderRecorded) * 100 : null;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-800 text-white p-6 shadow-md relative overflow-hidden">
        <div className="absolute -right-12 -top-14 h-56 w-56 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex-1 min-w-[260px]">
            <p className="text-slate-300 text-sm">FPO registry on FarmFresh</p>
            <h2 className="text-2xl font-bold mt-0.5">{num(a.total)} FPOs registered, {a.verified} verified</h2>
            <p className="mt-3 text-sm text-slate-200 max-w-xl">
              Present in <b>{a.stateCount}</b> state{a.stateCount === 1 ? '' : 's'}, declaring <b>{num(a.declaredFarmers)}</b> shareholder farmers.
              {a.pending > 0 && <> <b>{a.pending}</b> waiting for review.</>}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Ring value={a.verifiedPct} color="#6ee7b7" size={104}>
              <span className="text-2xl font-bold leading-none">{a.verifiedPct}%</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-200 mt-1">verified</span>
            </Ring>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Stat icon="shield" color="#059669" label="KYC verified" value={a.verified} sub={`${a.verifiedPct}% of all FPOs`} />
        <Stat icon="clock" color="#d97706" label="Pending review" value={a.pending} sub={a.overSevenDays ? `${a.overSevenDays} waiting 7+ days` : 'None overdue'} />
        <Stat icon="alert" color="#e11d48" label="Rejected" value={a.rejected} sub="FPO can correct and re-submit" />
        <Stat icon="map" color="#2563eb" label="States covered" value={a.stateCount} sub={a.states[0] ? `Most FPOs: ${a.states[0].label}` : ''} />
      </div>

      {/* Platform impact */}
      {s && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-emerald-900">Platform impact so far</h3>
              <p className="text-xs text-emerald-800">Totals across all FPOs. No individual farmer data is shown here.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              ['Farmers on record', num(s.farmers.total), womenPct !== null ? `${pct(womenPct)} women` : `${num(s.farmers.active)} active`],
              ['Land covered', `${num(s.farmers.landAcres)} acres`, 'as declared by FPOs'],
              ['Produce traced', kgCompact(s.batches.kg), `${num(s.batches.count)} batches`],
              ['Sales through platform', inrCompact(s.sales.value), `${num(s.sales.orders)} orders`],
              ['Paid to farmers', inrCompact(s.payouts.paid), `${num(s.payouts.count)} payouts`],
            ].map(([label, value, sub]) => (
              <div key={label}>
                <p className="text-[11px] uppercase tracking-wide text-emerald-800">{label}</p>
                <p className="text-xl font-bold text-emerald-950 mt-0.5">{value}</p>
                <p className="text-xs text-emerald-800">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="KYC status" subtitle="All registered FPOs">
          <Donut
            size={140}
            thickness={22}
            segments={[
              { label: 'Verified', value: a.verified, color: '#10b981' },
              { label: 'Pending', value: a.pending, color: '#f59e0b' },
              { label: 'Rejected', value: a.rejected, color: '#f43f5e' },
            ]}
            centerTop={a.total}
            centerBottom="FPOs"
          />
        </Card>
        <Card title="FPOs by state" subtitle="Top states">
          <HBars items={a.states} color="#2563eb" format={(v) => `${v} FPO${v === 1 ? '' : 's'}`} empty="No FPOs yet." />
        </Card>
        <Card title="New registrations" subtitle="Last 6 months">
          <Columns items={a.months} color="#059669" />
          {a.types.length > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              {a.types.map((t) => `${t.label}: ${t.value}`).join('  \u00B7  ')}
            </p>
          )}
        </Card>
      </div>

      {/* Review queue */}
      <Card title="Review queue" subtitle={a.queue.length ? 'Oldest first. FPOs without documents cannot be verified yet.' : 'No FPOs are waiting for review.'}>
        {a.queue.length ? (
          <ul className="divide-y divide-slate-100">
            {a.queue.slice(0, 6).map((q) => (
              <li key={q._id} className="flex items-center gap-4 py-2.5 text-sm">
                <span className={`h-2 w-2 rounded-full ${q.days >= 7 ? 'bg-rose-500' : 'bg-amber-400'}`} />
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-slate-900 truncate block">{q.name}</span>
                  <span className="text-xs text-slate-500">{q.state || 'State not stated'} &middot; waiting {q.days} day{q.days === 1 ? '' : 's'}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${q.docs ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {q.docs ? `${q.docs} document${q.docs > 1 ? 's' : ''}` : 'No documents'}
                </span>
                <button onClick={() => onReview(q._id)} className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-slate-50">Review</button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center py-6 text-emerald-700"><Icon name="check" className="h-8 w-8" /></div>
        )}
      </Card>
    </div>
  );
}
