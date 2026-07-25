import { useMemo } from 'react';
import { num } from '@/lib/format';

export interface ChartPoint {
  label: string;
  value: number;
}

const W = 720; // internal viewBox width; the SVG scales to its container
const PADX = 10;

/**
 * Cumulative-P/L equity curve (area + line) with a zero baseline. Pure SVG, no
 * dependency. Line/fill turn green when the series ends up, red when it ends down.
 */
export function EquityCurve({ points, height = 220 }: { points: ChartPoint[]; height?: number }) {
  const H = height;
  const padT = 14;
  const padB = 22;

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const vals = points.map((p) => num(p.value));
    let min = Math.min(0, ...vals);
    let max = Math.max(0, ...vals);
    if (min === max) max = min + 1;
    const innerH = H - padT - padB;
    const n = points.length;
    const x = (i: number) => PADX + (n === 1 ? (W - 2 * PADX) / 2 : (i / (n - 1)) * (W - 2 * PADX));
    const y = (v: number) => padT + ((max - v) / (max - min)) * innerH;
    const coords = points.map((p, i) => ({ x: x(i), y: y(num(p.value)) }));
    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const zeroY = y(0);
    const area = `${line} L ${coords[n - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
    const up = num(points[n - 1].value) >= 0;
    return { line, area, zeroY, coords, min, max, up };
  }, [points, H]);

  if (!geo) return null;
  const stroke = geo.up ? '#059669' : '#dc2626';
  const fill = geo.up ? '#059669' : '#dc2626';

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.18" />
            <stop offset="100%" stopColor={fill} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* zero baseline */}
        <line x1={PADX} y1={geo.zeroY} x2={W - PADX} y2={geo.zeroY} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
        <path d={geo.area} fill="url(#eqfill)" />
        <path d={geo.line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {geo.coords.length <= 30 &&
          geo.coords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r="2.5" fill={stroke} />)}
      </svg>
      <div className="flex justify-between px-1 text-[11px] text-gray-400">
        <span>{points[0].label}</span>
        {points.length > 1 && <span>{points[points.length - 1].label}</span>}
      </div>
    </div>
  );
}

/** Per-period P/L bars: green above the zero line, red below. */
export function PnlBars({ points, height = 160 }: { points: ChartPoint[]; height?: number }) {
  const H = height;
  const padT = 10;
  const padB = 10;

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const vals = points.map((p) => num(p.value));
    const max = Math.max(1e-9, ...vals.map((v) => Math.abs(v)));
    const innerH = H - padT - padB;
    const zeroY = padT + innerH / 2;
    const n = points.length;
    const slot = (W - 2 * PADX) / n;
    const bw = Math.min(28, slot * 0.6);
    const bars = points.map((p, i) => {
      const v = num(p.value);
      const h = (Math.abs(v) / max) * (innerH / 2);
      const cx = PADX + slot * i + slot / 2;
      return { x: cx - bw / 2, y: v >= 0 ? zeroY - h : zeroY, w: bw, h: Math.max(1, h), up: v >= 0 };
    });
    return { bars, zeroY };
  }, [points, H]);

  if (!geo) return null;
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
        <line x1={PADX} y1={geo.zeroY} x2={W - PADX} y2={geo.zeroY} stroke="#e5e7eb" strokeWidth="1" />
        {geo.bars.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="2" fill={b.up ? '#10b981' : '#ef4444'} />
        ))}
      </svg>
    </div>
  );
}
