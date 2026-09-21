// Indian-style number formatting helpers used by the dashboards.
const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export const num = (n) => nf.format(Math.round(Number(n) || 0));
export const num1 = (n) => nf1.format(Number(n) || 0);
export const inr2 = (n) => `\u20B9${(Number(n) || 0).toFixed(2)}`;
export const inr = (n) => `\u20B9${nf.format(Math.round(Number(n) || 0))}`;

// \u20B91.25 Cr / \u20B93.4 L / \u20B912.5K / \u20B9950
export const inrCompact = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e7) return `\u20B9${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `\u20B9${(v / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `\u20B9${(v / 1e3).toFixed(1)}K`;
  return `\u20B9${Math.round(v)}`;
};

export const kgCompact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${nf1.format(v / 1000)} t`;
  return `${nf1.format(v)} kg`;
};

export const pct = (n, d = 0) => `${(Number(n) || 0).toFixed(d)}%`;

export const timeAgo = (d, now = new Date()) => {
  const s = Math.max(0, (now - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export const greeting = (now = new Date()) => {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
