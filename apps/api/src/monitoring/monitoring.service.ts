import { Injectable, NotFoundException } from '@nestjs/common';
import { CopyEvent, CopyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { Actor, ownedBy } from '../common/scope';
import { StreamGateway } from './stream.gateway';
import { IngestCopyEvent, IngestSnapshot } from './monitoring.types';

export interface EventsQuery {
  from?: string;
  to?: string;
  limit?: number;
}

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: StreamGateway,
    private readonly mail: MailService,
  ) {}

  async ingestCopyEvent(evt: IngestCopyEvent): Promise<CopyEvent> {
    const row = await this.prisma.copyEvent.create({
      data: {
        copierConfigId: evt.copierConfigId,
        sourceAccountId: evt.sourceAccountId,
        receiverAccountId: evt.receiverAccountId,
        sourceTicket: evt.sourceTicket,
        receiverTicket: evt.receiverTicket,
        symbol: evt.symbol,
        side: evt.side,
        lots: evt.lots,
        sl: evt.sl,
        tp: evt.tp,
        action: evt.action,
        status: evt.status ?? CopyStatus.SUCCESS,
        latencyMs: evt.latencyMs,
        pnl: evt.pnl,
      },
    });
    this.gateway.emitCopyEvent(row);

    // Fire-and-forget failure alert (throttled inside MailService). Never blocks ingest.
    if (row.status === CopyStatus.FAILED) {
      void this.mail.sendCopyAlert({
        receiverAccountId: row.receiverAccountId,
        sourceAccountId: row.sourceAccountId,
        symbol: row.symbol,
        side: row.side,
        lots: row.lots.toString(),
        action: row.action,
      });
    }
    return row;
  }

  /**
   * Idempotent ingest keyed by `externalId` (a CopyFactory transaction id). Safe
   * to call repeatedly for the same transaction while polling — the first call
   * inserts + emits, later calls only refresh mutable fields (P/L, latency,
   * status, receiver ticket). Falls back to a plain insert when no externalId.
   */
  async upsertCopyEvent(evt: IngestCopyEvent): Promise<CopyEvent> {
    if (!evt.externalId) return this.ingestCopyEvent(evt);

    const existing = await this.prisma.copyEvent.findUnique({
      where: { externalId: evt.externalId },
      select: { id: true },
    });

    const data = {
      externalId: evt.externalId,
      copierConfigId: evt.copierConfigId,
      sourceAccountId: evt.sourceAccountId,
      receiverAccountId: evt.receiverAccountId,
      sourceTicket: evt.sourceTicket,
      receiverTicket: evt.receiverTicket,
      symbol: evt.symbol,
      side: evt.side,
      lots: evt.lots,
      sl: evt.sl,
      tp: evt.tp,
      action: evt.action,
      status: evt.status ?? CopyStatus.SUCCESS,
      latencyMs: evt.latencyMs,
      pnl: evt.pnl,
      ...(evt.ts ? { ts: evt.ts } : {}),
    };

    const row = await this.prisma.copyEvent.upsert({
      where: { externalId: evt.externalId },
      create: data,
      update: {
        status: data.status,
        latencyMs: data.latencyMs,
        pnl: data.pnl,
        receiverTicket: data.receiverTicket,
        lots: data.lots,
      },
    });

    // Only push to the live feed / alert on the first sighting.
    if (!existing) {
      this.gateway.emitCopyEvent(row);
      if (row.status === CopyStatus.FAILED) {
        void this.mail.sendCopyAlert({
          receiverAccountId: row.receiverAccountId,
          sourceAccountId: row.sourceAccountId,
          symbol: row.symbol,
          side: row.side,
          lots: row.lots.toString(),
          action: row.action,
        });
      }
    }
    return row;
  }

  async ingestSnapshot(snap: IngestSnapshot) {
    const row = await this.prisma.accountSnapshot.create({
      data: {
        accountId: snap.accountId,
        balance: snap.balance,
        equity: snap.equity,
        margin: snap.margin ?? 0,
        openPositions: snap.openPositions ?? 0,
      },
    });
    this.gateway.emitSnapshot(row);
    return row;
  }

  private async assertOwnsConfig(configId: string, actor: Actor): Promise<void> {
    const owns = await this.prisma.copierConfig.findFirst({
      where: { id: configId, ...ownedBy(actor) },
      select: { id: true },
    });
    if (!owns) throw new NotFoundException('Copier not found');
  }

  private async assertOwnsAccount(accountId: string, actor: Actor): Promise<void> {
    const owns = await this.prisma.account.findFirst({
      where: { id: accountId, ...ownedBy(actor), deletedAt: null },
      select: { id: true },
    });
    if (!owns) throw new NotFoundException('Account not found');
  }

  async copyEventsForConfig(configId: string, q: EventsQuery, actor: Actor): Promise<CopyEvent[]> {
    await this.assertOwnsConfig(configId, actor);
    const where: Prisma.CopyEventWhereInput = { copierConfigId: configId };
    this.applyRange(where, q);
    return this.prisma.copyEvent.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: q.limit ?? 100,
    });
  }

  async copyEventsForAccount(accountId: string, q: EventsQuery, actor: Actor): Promise<CopyEvent[]> {
    await this.assertOwnsAccount(accountId, actor);
    const where: Prisma.CopyEventWhereInput = {
      OR: [{ sourceAccountId: accountId }, { receiverAccountId: accountId }],
    };
    this.applyRange(where, q);
    return this.prisma.copyEvent.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: q.limit ?? 100,
    });
  }

  async latestSnapshot(accountId: string, actor: Actor) {
    await this.assertOwnsAccount(accountId, actor);
    return this.prisma.accountSnapshot.findFirst({
      where: { accountId },
      orderBy: { ts: 'desc' },
    });
  }

  /** Owner-scoped copy-event history across all the actor's copiers, with filters + paging. */
  async history(
    actor: Actor,
    q: { from?: string; to?: string; status?: CopyStatus; symbol?: string; limit?: number; offset?: number },
  ): Promise<{ items: CopyEvent[]; total: number }> {
    const mine = await this.prisma.copierConfig.findMany({
      where: ownedBy(actor),
      select: { id: true },
    });
    const where: Prisma.CopyEventWhereInput = {
      copierConfigId: { in: mine.map((c) => c.id) },
      ...(q.status ? { status: q.status } : {}),
      ...(q.symbol ? { symbol: { contains: q.symbol, mode: 'insensitive' } } : {}),
    };
    this.applyRange(where, q);
    const take = Math.min(q.limit ?? 100, 500);
    const skip = q.offset ?? 0;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.copyEvent.findMany({ where, orderBy: { ts: 'desc' }, take, skip }),
      this.prisma.copyEvent.count({ where }),
    ]);
    return { items, total };
  }

  private applyRange(where: Prisma.CopyEventWhereInput, q: EventsQuery): void {
    if (q.from || q.to) {
      where.ts = {
        gte: q.from ? new Date(q.from) : undefined,
        lte: q.to ? new Date(q.to) : undefined,
      };
    }
  }
}
