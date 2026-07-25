import { Injectable } from '@nestjs/common';
import { CopyEvent, CopyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
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

  copyEventsForConfig(configId: string, q: EventsQuery): Promise<CopyEvent[]> {
    const where: Prisma.CopyEventWhereInput = { copierConfigId: configId };
    this.applyRange(where, q);
    return this.prisma.copyEvent.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: q.limit ?? 100,
    });
  }

  copyEventsForAccount(accountId: string, q: EventsQuery): Promise<CopyEvent[]> {
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

  latestSnapshot(accountId: string) {
    return this.prisma.accountSnapshot.findFirst({
      where: { accountId },
      orderBy: { ts: 'desc' },
    });
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
