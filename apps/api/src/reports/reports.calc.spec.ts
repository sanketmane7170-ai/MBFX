import { CopyAction, CopyStatus, Prisma } from '@prisma/client';
import {
  ReportEvent,
  bucketOf,
  bySymbol,
  byPeriod,
  summarize,
  unrealizedFrom,
} from './reports.calc';

const dec = (v: number | string) => new Prisma.Decimal(v);

/** Build a CLOSE event carrying realized P/L. */
function close(ts: string, pnl: number | string, symbol = 'EURUSD', latencyMs?: number): ReportEvent {
  return {
    ts: new Date(ts),
    action: CopyAction.CLOSE,
    status: CopyStatus.SUCCESS,
    symbol,
    lots: dec(1),
    pnl: dec(pnl),
    latencyMs: latencyMs ?? null,
  };
}

/** Build an OPEN event (no realized P/L). */
function open(ts: string, lots: number | string, symbol = 'EURUSD', latencyMs?: number): ReportEvent {
  return {
    ts: new Date(ts),
    action: CopyAction.OPEN,
    status: CopyStatus.SUCCESS,
    symbol,
    lots: dec(lots),
    pnl: null,
    latencyMs: latencyMs ?? null,
  };
}

describe('summarize', () => {
  it('returns a zeroed summary for no events', () => {
    const s = summarize([]);
    expect(s.trades).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.realizedPnl).toBe('0');
    expect(s.maxDrawdown).toBe('0');
    expect(s.profitFactor).toBeNull();
    expect(s.bestTrade).toBeNull();
    expect(s.avgLatencyMs).toBeNull();
  });

  it('counts wins, losses and break-even trades', () => {
    const s = summarize([
      close('2026-07-01T10:00:00Z', 100),
      close('2026-07-01T11:00:00Z', -40),
      close('2026-07-01T12:00:00Z', 0),
    ]);
    expect(s.trades).toBe(3);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.breakEven).toBe(1);
    expect(s.winRate).toBeCloseTo(1 / 3);
  });

  it('computes realized P/L, gross figures and profit factor', () => {
    const s = summarize([
      close('2026-07-01T10:00:00Z', 150),
      close('2026-07-01T11:00:00Z', 50),
      close('2026-07-01T12:00:00Z', -80),
    ]);
    expect(s.realizedPnl).toBe('120');
    expect(s.grossProfit).toBe('200');
    expect(s.grossLoss).toBe('-80');
    expect(s.profitFactor).toBe(2.5);
    expect(s.bestTrade).toBe('150');
    expect(s.worstTrade).toBe('-80');
    expect(s.avgPnl).toBe('40');
  });

  it('leaves profit factor null when there are no losing trades', () => {
    const s = summarize([close('2026-07-01T10:00:00Z', 10)]);
    expect(s.profitFactor).toBeNull();
  });

  it('keeps decimal precision instead of drifting like a float', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754 floats (NFR-3).
    const s = summarize([close('2026-07-01T10:00:00Z', '0.1'), close('2026-07-01T11:00:00Z', '0.2')]);
    expect(s.realizedPnl).toBe('0.3');
  });

  it('measures max drawdown as the largest peak-to-trough drop', () => {
    // Curve: 100 → 60 → 160 → 60 → 110. Peak 160, trough 60 → drawdown 100.
    const s = summarize([
      close('2026-07-01T10:00:00Z', 100),
      close('2026-07-01T11:00:00Z', -40),
      close('2026-07-01T12:00:00Z', 100),
      close('2026-07-01T13:00:00Z', -100),
      close('2026-07-01T14:00:00Z', 50),
    ]);
    expect(s.realizedPnl).toBe('110');
    expect(s.maxDrawdown).toBe('100');
  });

  it('reports zero drawdown for a monotonically rising curve', () => {
    const s = summarize([close('2026-07-01T10:00:00Z', 10), close('2026-07-01T11:00:00Z', 20)]);
    expect(s.maxDrawdown).toBe('0');
  });

  it('orders events by time before walking the drawdown curve', () => {
    const ordered = summarize([
      close('2026-07-01T10:00:00Z', 100),
      close('2026-07-01T11:00:00Z', -60),
    ]);
    const shuffled = summarize([
      close('2026-07-01T11:00:00Z', -60),
      close('2026-07-01T10:00:00Z', 100),
    ]);
    expect(shuffled.maxDrawdown).toBe(ordered.maxDrawdown);
    expect(shuffled.maxDrawdown).toBe('60');
  });

  it('sums volume from OPEN events and averages non-null latencies', () => {
    const s = summarize([
      open('2026-07-01T10:00:00Z', '1.5', 'EURUSD', 100),
      open('2026-07-01T10:00:01Z', '0.5', 'EURUSD', 200),
      close('2026-07-01T11:00:00Z', 25, 'EURUSD'),
    ]);
    expect(s.volumeLots).toBe('2');
    expect(s.opened).toBe(2);
    expect(s.closed).toBe(1);
    expect(s.avgLatencyMs).toBe(150);
  });

  it('counts failed and filtered events', () => {
    const failed = { ...open('2026-07-01T10:00:00Z', 1), status: CopyStatus.FAILED };
    const filtered = { ...open('2026-07-01T10:01:00Z', 1), status: CopyStatus.FILTERED };
    const s = summarize([failed, filtered]);
    expect(s.failed).toBe(1);
    expect(s.filtered).toBe(1);
  });

  it('ignores CLOSE events with no P/L recorded', () => {
    const noPnl: ReportEvent = { ...close('2026-07-01T10:00:00Z', 0), pnl: null };
    const s = summarize([noPnl, close('2026-07-01T11:00:00Z', 30)]);
    expect(s.trades).toBe(1);
    expect(s.realizedPnl).toBe('30');
  });
});

describe('bucketOf', () => {
  it('buckets by UTC day', () => {
    expect(bucketOf(new Date('2026-07-25T23:59:59Z'), 'day').key).toBe('2026-07-25');
  });

  it('buckets by month', () => {
    expect(bucketOf(new Date('2026-07-25T12:00:00Z'), 'month').key).toBe('2026-07');
  });

  it('buckets by ISO week, starting Monday', () => {
    // 2026-07-25 is a Saturday; its ISO week starts Monday 2026-07-20.
    const b = bucketOf(new Date('2026-07-25T12:00:00Z'), 'week');
    expect(b.start.toISOString()).toBe('2026-07-20T00:00:00.000Z');
    expect(b.key).toBe('2026-W30');
  });

  it('puts Sunday in the week that began the preceding Monday', () => {
    const sunday = bucketOf(new Date('2026-07-26T12:00:00Z'), 'week');
    const monday = bucketOf(new Date('2026-07-20T12:00:00Z'), 'week');
    expect(sunday.key).toBe(monday.key);
  });

  it('assigns a year-boundary date to the ISO week-year, not the calendar year', () => {
    // 2027-01-01 is a Friday, so it belongs to ISO week 53 of week-year 2026.
    expect(bucketOf(new Date('2027-01-01T00:00:00Z'), 'week').key).toBe('2026-W53');
  });
});

describe('byPeriod', () => {
  it('groups realized trades and carries a running cumulative', () => {
    const rows = byPeriod(
      [
        close('2026-07-01T10:00:00Z', 100),
        close('2026-07-01T15:00:00Z', -30),
        close('2026-07-02T10:00:00Z', 50),
      ],
      'day',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ period: '2026-07-01', trades: 2, wins: 1, losses: 1, pnl: '70', cumulativePnl: '70' });
    expect(rows[1]).toMatchObject({ period: '2026-07-02', trades: 1, pnl: '50', cumulativePnl: '120' });
  });

  it('returns periods oldest-first regardless of input order', () => {
    const rows = byPeriod(
      [close('2026-07-03T10:00:00Z', 10), close('2026-07-01T10:00:00Z', 20)],
      'day',
    );
    expect(rows.map((r) => r.period)).toEqual(['2026-07-01', '2026-07-03']);
  });

  it('rolls up by month', () => {
    const rows = byPeriod(
      [
        close('2026-06-30T10:00:00Z', 10),
        close('2026-07-01T10:00:00Z', 20),
        close('2026-07-28T10:00:00Z', 5),
      ],
      'month',
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ period: '2026-07', trades: 2, pnl: '25', cumulativePnl: '35' });
  });

  it('returns nothing when there are no realized trades', () => {
    expect(byPeriod([open('2026-07-01T10:00:00Z', 1)], 'day')).toEqual([]);
  });
});

describe('bySymbol', () => {
  it('aggregates per symbol and sorts most profitable first', () => {
    const rows = bySymbol([
      open('2026-07-01T10:00:00Z', 2, 'EURUSD'),
      close('2026-07-01T11:00:00Z', -20, 'EURUSD'),
      open('2026-07-01T10:00:00Z', 1, 'GBPUSD'),
      close('2026-07-01T11:00:00Z', 80, 'GBPUSD'),
      close('2026-07-01T12:00:00Z', 20, 'GBPUSD'),
    ]);
    expect(rows.map((r) => r.symbol)).toEqual(['GBPUSD', 'EURUSD']);
    expect(rows[0]).toMatchObject({ trades: 2, wins: 2, pnl: '100', volumeLots: '1' });
    expect(rows[1]).toMatchObject({ trades: 1, wins: 0, pnl: '-20', volumeLots: '2' });
    expect(rows[0].winRate).toBe(1);
  });
});

describe('unrealizedFrom', () => {
  it('derives unrealized P/L from equity minus balance', () => {
    expect(unrealizedFrom({ balance: dec(1000), equity: dec(1075.5) })).toBe('75.5');
  });

  it('returns a negative figure when equity is below balance', () => {
    expect(unrealizedFrom({ balance: dec(1000), equity: dec(940) })).toBe('-60');
  });

  it('returns null (unknown, not zero) when no snapshot exists', () => {
    expect(unrealizedFrom(null)).toBeNull();
  });
});
