/** Shared number/money/percent formatting for dashboards + reports. */

export const num = (v: string | number | null | undefined): number => {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Fixed 2-decimal money. `sign` prefixes a "+" on positive values. */
export function money(v: string | number | null | undefined, opts: { sign?: boolean } = {}): string {
  const n = num(v);
  const s = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n < 0) return `-${s}`;
  return opts.sign && n > 0 ? `+${s}` : s;
}

/** A 0–1 fraction rendered as a whole-number percentage. */
export const pct = (fraction: number | null | undefined): string => `${Math.round(num(fraction) * 100)}%`;

/** Tailwind text color for a P/L value. */
export const pnlColor = (v: string | number | null | undefined): string =>
  num(v) > 0 ? 'text-emerald-600' : num(v) < 0 ? 'text-red-600' : 'text-gray-500';
