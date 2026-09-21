import { useRef, useState } from 'react';

// Small dependency-free SVG chart kit for the dashboards.

const niceCeil = (v) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
};

export function Sparkline({ data = [], color = '#059669', height = 34, width = 110 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const step = width / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => [i * step, height - 3 - (v / max) * (height - 8)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const id = `sg${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Single-series area chart with hover tooltip. data: [{ date, value }]
export function AreaChart({ data = [], color = '#059669', height = 270, formatY = (v) => v, formatTip }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 720;
  const pad = { l: 52, r: 14, t: 14, b: 26 };
  const n = data.length;
  const max = niceCeil(Math.max(...data.map((d) => d.value), 0));
  const x = (i) => pad.l + (n > 1 ? (i / (n - 1)) * (W - pad.l - pad.r) : 0);
  const y = (v) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1)} ${height - pad.b} L${x(0)} ${height - pad.b} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const id = `ag${color.replace('#', '')}`;
  const empty = data.every((d) => d.value === 0);

  const onMove = (e) => {
    const box = ref.current.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hd = hover !== null ? data[hover] : null;
  return (
    <div className="relative" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Trend chart" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={i ? '3 4' : ''} />
            <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#64748b">{formatY(t)}</text>
          </g>
        ))}
        {data.map((d, i) =>
          i % 5 === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">
              {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </text>
          ) : null
        )}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {hd && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="#94a3b8" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(hd.value)} r="4.5" fill="#fff" stroke={color} strokeWidth="2.4" />
          </g>
        )}
        {empty && (
          <text x={W / 2} y={height / 2} textAnchor="middle" fontSize="12" fill="#94a3b8">No activity in the last 30 days</text>
        )}
      </svg>
      {hd && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(hd.value) / height) * 100}%`, marginTop: -8 }}
        >
          <div className="text-slate-300">{new Date(hd.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
          <div className="font-semibold">{formatTip ? formatTip(hd.value) : formatY(hd.value)}</div>
        </div>
      )}
    </div>
  );
}

// Donut with a legend. segments: [{ label, value, color }]
export function Donut({ segments = [], size = 150, thickness = 22, centerTop, centerBottom, format = (v) => v }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution chart">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {total > 0 &&
            segments.map((s, i) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${Math.max(len - 1.5, 0)} ${c}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-slate-900 leading-none">{centerTop}</span>
          {centerBottom && <span className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{centerBottom}</span>}
        </div>
      </div>
      <ul className="space-y-1.5 text-sm min-w-[130px]">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="ml-auto font-medium text-slate-900">{format(s.value)}</span>
            {total > 0 && <span className="text-xs text-slate-400 w-9 text-right">{Math.round((s.value / total) * 100)}%</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Horizontal bars. items: [{ label, value, color?, note? }]
export function HBars({ items = [], color = '#059669', format = (v) => v, empty = 'No data yet' }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) return <p className="text-sm text-slate-400 py-6 text-center">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-700 font-medium truncate pr-2">{it.label}</span>
            <span className="text-slate-500 whitespace-nowrap">{format(it.value)}{it.note ? ` \u00B7 ${it.note}` : ''}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.max((it.value / max) * 100, 2)}%`, background: it.color || color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Vertical columns (e.g. registrations per month). items: [{ label, value }]
export function Columns({ items = [], color = '#059669', height = 120 }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {items.map((it) => (
        <div key={it.label} className="flex-1 flex flex-col items-center justify-end h-full">
          <span className="text-[11px] font-semibold text-slate-700 mb-1">{it.value || ''}</span>
          <div className="w-full rounded-t-md" style={{ height: `${Math.max((it.value / max) * (height - 34), it.value ? 6 : 2)}px`, background: it.value ? color : '#e2e8f0' }} />
          <span className="text-[10px] text-slate-500 mt-1.5">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// Progress ring, e.g. readiness 5/8
export function Ring({ value = 0, size = 96, thickness = 9, color = '#34d399', track = 'rgba(255,255,255,0.22)', children }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${(Math.min(value, 100) / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">{children}</div>
    </div>
  );
}

// Stage pipeline, e.g. order funnel. stages: [{ label, value }]
export function Pipeline({ stages = [], color = '#059669' }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => (
        <li key={s.label} className="flex items-center gap-3">
          <span className="w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center justify-center">{i + 1}</span>
          <span className="w-20 text-xs text-slate-600">{s.label}</span>
          <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
            <div className="h-full rounded flex items-center justify-end pr-2 text-[11px] font-semibold text-white" style={{ width: `${Math.max((s.value / max) * 100, s.value ? 12 : 0)}%`, background: color, opacity: 0.55 + 0.45 * ((i + 1) / stages.length) }}>
              {s.value || ''}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Delta({ value }) {
  if (value === null || value === undefined) return <span className="text-xs text-slate-400">new</span>;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d={up ? 'M5 1 L9 7 L1 7 Z' : 'M5 9 L9 3 L1 3 Z'} fill="currentColor" />
      </svg>
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

// Simple geometric icons (no icon library needed)
export function Icon({ name, className = 'h-5 w-5' }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    users: <><circle cx="9" cy="8" r="3.2" {...p} /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" {...p} /><path d="M16 5.2a3 3 0 010 5.6M18 14.4c1.6.6 2.7 2 3 4.6" {...p} /></>,
    box: <><path d="M12 3l8 4.2v9.6L12 21l-8-4.2V7.2L12 3z" {...p} /><path d="M4 7.2l8 4.3 8-4.3M12 11.5V21" {...p} /></>,
    cash: <><rect x="3" y="6" width="18" height="12" rx="2" {...p} /><circle cx="12" cy="12" r="2.6" {...p} /></>,
    trend: <><path d="M3 17l6-6 4 4 8-9" {...p} /><path d="M15 6h6v6" {...p} /></>,
    shield: <><path d="M12 3l8 3v6c0 4.4-3.2 7.6-8 9-4.8-1.4-8-4.6-8-9V6l8-3z" {...p} /><path d="M8.5 12l2.4 2.4L15.6 9.6" {...p} /></>,
    alert: <><path d="M12 4l9 16H3L12 4z" {...p} /><path d="M12 10v4M12 17.2v.1" {...p} /></>,
    check: <path d="M5 12.5l4.2 4.2L19 7" {...p} />,
    qr: <><rect x="4" y="4" width="6" height="6" rx="1" {...p} /><rect x="14" y="4" width="6" height="6" rx="1" {...p} /><rect x="4" y="14" width="6" height="6" rx="1" {...p} /><path d="M14 14h2.5v2.5M20 14v.1M14 20h2M18.5 18v2.5H20" {...p} /></>,
    clock: <><circle cx="12" cy="12" r="8.5" {...p} /><path d="M12 7.5V12l3 2" {...p} /></>,
    leaf: <><path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15" {...p} /><path d="M5 19c3-4 6-7 10-9" {...p} /></>,
    file: <><path d="M7 3h7l4 4v14H7V3z" {...p} /><path d="M14 3v4h4M10 12h5M10 16h5" {...p} /></>,
    map: <><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" {...p} /><circle cx="12" cy="10" r="2.4" {...p} /></>,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
}
