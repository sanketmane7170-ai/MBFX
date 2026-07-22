import { Injectable } from '@nestjs/common';
import {
  CopyEvent,
  CopyStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

  /** Persist a copy event and broadcast it to the master + slave rooms. */
  async ingestCopyEvent(evt: IngestCopyEvent): Promise<CopyEvent> {
    const row = await this.prisma.copyEvent.create({
      data: {
        masterAccountId: evt.masterAccountId,
        slaveAccountId: evt.slaveAccountId,
        masterTicket: evt.masterTicket,
        slaveTicket: evt.slaveTicket,
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
    return row;
  }

  /** Persist an account snapshot and broadcast it to that account's room. */
  async ingestSnapshot(snap: IngestSnapshot) {
    const row = await this.prisma.accountSnapshot.create({
      data: {
        accountId: snap.accountId,
        accountType: snap.accountType,
        balance: snap.balance,
        equity: snap.equity,
        margin: snap.margin ?? 0,
        openPositions: snap.openPositions ?? 0,
      },
    });
    this.gateway.emitSnapshot(row);
    return row;
  }

  copyEventsForMaster(id: string, q: EventsQuery): Promise<CopyEvent[]> {
    return this.prisma.copyEvent.findMany({
      where: this.whereEvents('masterAccountId', id, q),
      orderBy: { ts: 'desc' },
      take: q.limit ?? 100,
    });
  }

  copyEventsForSlave(id: string, q: EventsQuery): Promise<CopyEvent[]> {
    return this.prisma.copyEvent.findMany({
      where: this.whereEvents('slaveAccountId', id, q),
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

  private whereEvents(
    field: 'masterAccountId' | 'slaveAccountId',
    id: string,
    q: EventsQuery,
  ): Prisma.CopyEventWhereInput {
    const where: Prisma.CopyEventWhereInput = { [field]: id };
    if (q.from || q.to) {
      where.ts = {
        gte: q.from ? new Date(q.from) : undefined,
        lte: q.to ? new Date(q.to) : undefined,
      };
    }
    return where;
  }
}
