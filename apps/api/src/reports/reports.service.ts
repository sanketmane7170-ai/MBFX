import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, ownedBy } from '../common/scope';
import {
  Bucket,
  PeriodRow,
  ReportEvent,
  ReportSummary,
  SymbolRow,
  bySymbol,
  byPeriod,
  summarize,
  unrealizedFrom,
} from './reports.calc';
import { ReportQueryDto } from './dto/report-query.dto';

/** Only the columns the report math consumes. */
const EVENT_SELECT = {
  ts: true,
  action: true,
  status: true,
  symbol: true,
  lots: true,
  pnl: true,
  latencyMs: true,
} satisfies Prisma.CopyEventSelect;

export interface AccountReport {
  account: { id: string; label: string; login: string; platform: string };
  range: { from: string | null; to: string | null; bucket: Bucket };
  summary: ReportSummary;
  /** equity − balance from the latest snapshot; null when no snapshot exists. */
  unrealizedPnl: string | null;
  snapshotAt: string | null;
  periods: PeriodRow[];
  symbols: SymbolRow[];
  /** Present only when this account is the source of a copier. */
  asSource: { events: number; receivers: number; aggregateReceiverPnl: string } | null;
}

export interface OverviewReport {
  range: { from: string | null; to: string | null; bucket: Bucket };
  summary: ReportSummary;
  periods: PeriodRow[];
  symbols: SymbolRow[];
  accounts: Array<{
    accountId: string;
    label: string;
    trades: number;
    wins: number;
    winRate: number;
    realizedPnl: string;
    maxDrawdown: string;
  }>;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(q: ReportQueryDto): Prisma.CopyEventWhereInput {
    if (!q.from && !q.to) return {};
    return {
      ts: {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      },
    };
  }

  private bucket(q: ReportQueryDto): Bucket {
    return q.bucket ?? 'day';
  }

  private async assertOwnsAccount(accountId: string, actor: Actor) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, ...ownedBy(actor), deletedAt: null },
      select: { id: true, label: true, login: true, platform: true },
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  /**
   * Financial report for one account.
   *
   * Financials are scoped to the account as RECEIVER, because CopyEvent.pnl records
   * the receiver's realized result. Summing events where the account is the source
   * would aggregate its receivers' P/L, not its own — that fan-out total is reported
   * separately under `asSource`.
   */
  async forAccount(accountId: string, q: ReportQueryDto, actor: Actor): Promise<AccountReport> {
    const account = await this.assertOwnsAccount(accountId, actor);
    const range = this.range(q);
    const bucket = this.bucket(q);

    const [events, snapshot, sourceEvents] = await Promise.all([
      this.prisma.copyEvent.findMany({
        where: { receiverAccountId: accountId, ...range },
        select: EVENT_SELECT,
        orderBy: { ts: 'asc' },
      }),
      this.prisma.accountSnapshot.findFirst({
        where: { accountId },
        orderBy: { ts: 'desc' },
        select: { balance: true, equity: true, ts: true },
      }),
      this.prisma.copyEvent.findMany({
        where: { sourceAccountId: accountId, ...range },
        select: { pnl: true, receiverAccountId: true },
      }),
    ]);

    const asSource = sourceEvents.length
      ? {
          events: sourceEvents.length,
          receivers: new Set(sourceEvents.map((e) => e.receiverAccountId)).size,
          aggregateReceiverPnl: sourceEvents
            .reduce(
              (acc, e) => (e.pnl ? acc.plus(e.pnl) : acc),
              new Prisma.Decimal(0),
            )
            .toString(),
        }
      : null;

    return {
      account,
      range: { from: q.from ?? null, to: q.to ?? null, bucket },
      summary: summarize(events as ReportEvent[]),
      unrealizedPnl: unrealizedFrom(snapshot),
      snapshotAt: snapshot?.ts.toISOString() ?? null,
      periods: byPeriod(events as ReportEvent[], bucket),
      symbols: bySymbol(events as ReportEvent[]),
      asSource,
    };
  }

  /** Portfolio-wide report across every copier the actor owns. */
  async overview(q: ReportQueryDto, actor: Actor): Promise<OverviewReport> {
    const range = this.range(q);
    const bucket = this.bucket(q);

    const mine = await this.prisma.copierConfig.findMany({
      where: ownedBy(actor),
      select: { id: true },
    });

    const rows = await this.prisma.copyEvent.findMany({
      where: { copierConfigId: { in: mine.map((c) => c.id) }, ...range },
      select: { ...EVENT_SELECT, receiverAccountId: true },
      orderBy: { ts: 'asc' },
    });

    const events = rows as ReportEvent[];

    // Per-receiver breakdown, labelled from the accounts table.
    const byAccount = new Map<string, ReportEvent[]>();
    for (const r of rows) {
      const list = byAccount.get(r.receiverAccountId) ?? [];
      list.push(r as ReportEvent);
      byAccount.set(r.receiverAccountId, list);
    }

    const labels = await this.prisma.account.findMany({
      where: { id: { in: [...byAccount.keys()] } },
      select: { id: true, label: true },
    });
    const labelOf = new Map(labels.map((a) => [a.id, a.label]));

    const accounts = [...byAccount.entries()]
      .map(([accountId, list]) => {
        const s = summarize(list);
        return {
          accountId,
          label: labelOf.get(accountId) ?? 'Deleted account',
          trades: s.trades,
          wins: s.wins,
          winRate: s.winRate,
          realizedPnl: s.realizedPnl,
          maxDrawdown: s.maxDrawdown,
        };
      })
      .sort((a, b) => new Prisma.Decimal(b.realizedPnl).comparedTo(new Prisma.Decimal(a.realizedPnl)));

    return {
      range: { from: q.from ?? null, to: q.to ?? null, bucket },
      summary: summarize(events),
      periods: byPeriod(events, bucket),
      symbols: bySymbol(events),
      accounts,
    };
  }
}
