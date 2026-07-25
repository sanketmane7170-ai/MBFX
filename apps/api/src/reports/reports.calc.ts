import { CopyAction, CopyStatus, Prisma } from '@prisma/client';

/**
 * Pure report math — no Prisma client, no Nest, no I/O, so it unit-tests directly.
 *
 * All money is computed with Prisma.Decimal and serialized as a string (NFR-3:
 * decimals, never floats). Counts, rates and latencies stay plain numbers.
 */

type Decimal = Prisma.Decimal;
const dec = (v: Prisma.Decimal.Value): Decimal => new Prisma.Decimal(v);
const ZERO = (): Decimal => dec(0);

const DAY_MS = 86_400_000;

/** The subset of a CopyEvent the report math needs. */
export interface ReportEvent {
  ts: Date;
  action: CopyAction;
  status: CopyStatus;
  symbol: string;
  lots: Decimal;
  pnl: Decimal | null;
  latencyMs: number | null;
}

export type Bucket = 'day' | 'week' | 'month';

export interface ReportSummary {
  /** Realized trades = CLOSE events carrying a P/L figure. */
  trades: number;
  wins: number;
  losses: number;
  breakEven: number;
  /** 0..1; 0 when there are no realized trades. */
  winRate: number;
  realizedPnl: string;
  grossProfit: string;
  grossLoss: string;
  /** grossProfit / |grossLoss|; null when there are no losses to divide by. */
  profitFactor: number | null;
  avgPnl: string;
  bestTrade: string | null;
  worstTrade: string | null;
  /** Largest peak-to-trough drop of the cumulative realized-P/L curve, as a positive magnitude. */
  maxDrawdown: string;
  volumeLots: string;
  opened: number;
  closed: number;
  failed: number;
  filtered: number;
  avgLatencyMs: number | null;
}

export interface PeriodRow {
  /** '2026-07-25' (day), '2026-W30' (ISO week), or '2026-07' (month). */
  period: string;
  start: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: string;
  cumulativePnl: string;
}

export interface SymbolRow {
  symbol: string;
  trades: number;
  wins: number;
  winRate: number;
  pnl: string;
  volumeLots: string;
}

// ---------------------------------------------------------------------------
// Bucketing (UTC, so results are deterministic regardless of server timezone)
// ---------------------------------------------------------------------------

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

function dayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Monday-based week start (ISO-8601). */
function weekStart(d: Date): Date {
  const s = dayStart(d);
  const mondayOffset = (s.getUTCDay() + 6) % 7; // Sun=6, Mon=0
  s.setUTCDate(s.getUTCDate() - mondayOffset);
  return s;
}

/** ISO-8601 week number, with the week-year the Thursday falls in. */
function isoWeek(d: Date): { year: number; week: number } {
  const ws = weekStart(d);
  const thursday = new Date(ws.getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const firstWeek = weekStart(new Date(Date.UTC(year, 0, 4)));
  const week = Math.round((ws.getTime() - firstWeek.getTime()) / (7 * DAY_MS)) + 1;
  return { year, week };
}

/** The bucket key + bucket start instant a timestamp belongs to. */
export function bucketOf(ts: Date, bucket: Bucket): { key: string; start: Date } {
  if (bucket === 'month') {
    const start = monthStart(ts);
    return { key: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`, start };
  }
  if (bucket === 'week') {
    const start = weekStart(ts);
    const { year, week } = isoWeek(ts);
    return { key: `${year}-W${pad(week)}`, start };
  }
  const start = dayStart(ts);
  return {
    key: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`,
    start,
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** Realized trades, oldest first — the basis for P/L, win rate and drawdown. */
function realized(events: ReportEvent[]): ReportEvent[] {
  return events
    .filter((e) => e.action === CopyAction.CLOSE && e.pnl != null)
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

export function summarize(events: ReportEvent[]): ReportSummary {
  const closes = realized(events);

  let wins = 0;
  let losses = 0;
  let breakEven = 0;
  let grossProfit = ZERO();
  let grossLoss = ZERO(); // accumulated as a negative number
  let best: Decimal | null = null;
  let worst: Decimal | null = null;

  // Cumulative curve + running peak, for max drawdown.
  let cumulative = ZERO();
  let peak = ZERO();
  let maxDrawdown = ZERO();

  for (const e of closes) {
    const pnl = e.pnl as Decimal;
    if (pnl.greaterThan(0)) {
      wins += 1;
      grossProfit = grossProfit.plus(pnl);
    } else if (pnl.lessThan(0)) {
      losses += 1;
      grossLoss = grossLoss.plus(pnl);
    } else {
      breakEven += 1;
    }

    if (best === null || pnl.greaterThan(best)) best = pnl;
    if (worst === null || pnl.lessThan(worst)) worst = pnl;

    cumulative = cumulative.plus(pnl);
    if (cumulative.greaterThan(peak)) peak = cumulative;
    const drop = peak.minus(cumulative);
    if (drop.greaterThan(maxDrawdown)) maxDrawdown = drop;
  }

  const trades = closes.length;
  const realizedPnl = grossProfit.plus(grossLoss);

  const latencies = events.map((e) => e.latencyMs).filter((l): l is number => l != null);
  const avgLatencyMs = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  const volumeLots = events
    .filter((e) => e.action === CopyAction.OPEN)
    .reduce((acc, e) => acc.plus(e.lots), ZERO());

  return {
    trades,
    wins,
    losses,
    breakEven,
    winRate: trades ? wins / trades : 0,
    realizedPnl: realizedPnl.toString(),
    grossProfit: grossProfit.toString(),
    grossLoss: grossLoss.toString(),
    profitFactor: grossLoss.isZero()
      ? null
      : grossProfit.dividedBy(grossLoss.abs()).toDecimalPlaces(4).toNumber(),
    avgPnl: trades ? realizedPnl.dividedBy(trades).toDecimalPlaces(2).toString() : '0',
    bestTrade: best?.toString() ?? null,
    worstTrade: worst?.toString() ?? null,
    maxDrawdown: maxDrawdown.toString(),
    volumeLots: volumeLots.toString(),
    opened: events.filter((e) => e.action === CopyAction.OPEN).length,
    closed: events.filter((e) => e.action === CopyAction.CLOSE).length,
    failed: events.filter((e) => e.status === CopyStatus.FAILED).length,
    filtered: events.filter((e) => e.status === CopyStatus.FILTERED).length,
    avgLatencyMs,
  };
}

/** Per-period rollup of realized P/L, oldest period first, with a running cumulative. */
export function byPeriod(events: ReportEvent[], bucket: Bucket): PeriodRow[] {
  const groups = new Map<
    string,
    { start: Date; trades: number; wins: number; losses: number; pnl: Decimal }
  >();

  for (const e of realized(events)) {
    const { key, start } = bucketOf(e.ts, bucket);
    const g =
      groups.get(key) ?? { start, trades: 0, wins: 0, losses: 0, pnl: ZERO() };
    const pnl = e.pnl as Decimal;
    g.trades += 1;
    if (pnl.greaterThan(0)) g.wins += 1;
    else if (pnl.lessThan(0)) g.losses += 1;
    g.pnl = g.pnl.plus(pnl);
    groups.set(key, g);
  }

  let cumulative = ZERO();
  return [...groups.entries()]
    .sort((a, b) => a[1].start.getTime() - b[1].start.getTime())
    .map(([period, g]) => {
      cumulative = cumulative.plus(g.pnl);
      return {
        period,
        start: g.start.toISOString(),
        trades: g.trades,
        wins: g.wins,
        losses: g.losses,
        winRate: g.trades ? g.wins / g.trades : 0,
        pnl: g.pnl.toString(),
        cumulativePnl: cumulative.toString(),
      };
    });
}

/** Per-symbol rollup, most profitable first. */
export function bySymbol(events: ReportEvent[]): SymbolRow[] {
  const groups = new Map<string, { trades: number; wins: number; pnl: Decimal; lots: Decimal }>();

  for (const e of events) {
    const g = groups.get(e.symbol) ?? { trades: 0, wins: 0, pnl: ZERO(), lots: ZERO() };
    if (e.action === CopyAction.OPEN) g.lots = g.lots.plus(e.lots);
    if (e.action === CopyAction.CLOSE && e.pnl != null) {
      g.trades += 1;
      g.pnl = g.pnl.plus(e.pnl);
      if (e.pnl.greaterThan(0)) g.wins += 1;
    }
    groups.set(e.symbol, g);
  }

  return [...groups.entries()]
    .map(([symbol, g]) => ({
      symbol,
      trades: g.trades,
      wins: g.wins,
      winRate: g.trades ? g.wins / g.trades : 0,
      pnl: g.pnl.toString(),
      volumeLots: g.lots.toString(),
    }))
    .sort((a, b) => dec(b.pnl).comparedTo(dec(a.pnl)));
}

/**
 * Unrealized P/L implied by the latest account snapshot (equity − balance).
 * Null when no snapshot exists — snapshots are only populated while an account
 * is being polled, so callers must treat this as "unknown", not zero.
 */
export function unrealizedFrom(
  snapshot: { balance: Decimal; equity: Decimal } | null,
): string | null {
  if (!snapshot) return null;
  return snapshot.equity.minus(snapshot.balance).toString();
}
