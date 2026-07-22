import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountType,
  CopyAction,
  CopyStatus,
  SizingMode,
  Side,
} from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoringService } from './monitoring.service';
import { SimulateOpenDto } from './dto/simulate-open.dto';

/**
 * DEV-ONLY driver that mimics what CopyFactory does: a master trade fans out to
 * every enabled slave (applying sizing, reverse and symbol mapping), producing
 * copy events that flow through MonitoringService → DB + WebSocket.
 * Disabled whenever a real MetaApi provider is active (METAAPI_TOKEN set).
 */
@Injectable()
export class SimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoring: MonitoringService,
    private readonly config: ConfigService,
  ) {}

  private ensureDev(): void {
    const token = this.config.get<string>('METAAPI_TOKEN');
    if (token && token.trim().length > 0) {
      throw new ForbiddenException(
        'Simulation is disabled while the real MetaApi provider is active.',
      );
    }
  }

  private static computeLots(
    mode: SizingMode,
    masterLots: number,
    multiplier: number,
  ): number {
    switch (mode) {
      case SizingMode.FIXED_LOT:
        return round2(multiplier);
      case SizingMode.MULTIPLIER:
        return round2(masterLots * multiplier);
      case SizingMode.BALANCE_RATIO:
      default:
        // No live balances in simulation — fall back to master lots.
        return round2(masterLots);
    }
  }

  private static mapSymbol(mapping: unknown, symbol: string): string {
    if (Array.isArray(mapping)) {
      const found = (mapping as Array<{ from?: string; to?: string }>).find(
        (m) => m.from === symbol,
      );
      if (found?.to) return found.to;
    }
    return symbol;
  }

  async open(masterId: string, dto: SimulateOpenDto) {
    this.ensureDev();
    const master = await this.prisma.masterAccount.findUnique({
      where: { id: masterId },
    });
    if (!master) throw new NotFoundException('Master account not found');

    const slaves = await this.prisma.slaveAccount.findMany({
      where: { masterAccountId: masterId, enabled: true },
    });

    const symbol = dto.symbol ?? 'EURUSD';
    const side = dto.side ?? Side.BUY;
    const lots = dto.lots ?? 1.0;
    const masterTicket = dto.masterTicket ?? String(randomInt(10_000_000, 99_999_999));

    for (const slave of slaves) {
      const slaveLots = SimulationService.computeLots(
        slave.sizingMode,
        lots,
        Number(slave.multiplier),
      );
      const effectiveSide = slave.reverse ? flip(side) : side;
      const mappedSymbol = SimulationService.mapSymbol(
        slave.symbolMapping,
        symbol,
      );

      await this.monitoring.ingestCopyEvent({
        masterAccountId: masterId,
        slaveAccountId: slave.id,
        masterTicket,
        slaveTicket: `S${randomInt(1_000_000, 9_999_999)}`,
        symbol: mappedSymbol,
        side: effectiveSide,
        lots: slaveLots,
        sl: slave.copySl ? dto.sl : undefined,
        tp: slave.copyTp ? dto.tp : undefined,
        action: CopyAction.OPEN,
        status: CopyStatus.SUCCESS,
        latencyMs: randomInt(30, 140),
      });
    }

    // A demo master snapshot so the account_snapshot channel is exercised too.
    await this.monitoring.ingestSnapshot({
      accountId: masterId,
      accountType: AccountType.MASTER,
      balance: 10_000,
      equity: 10_000 + randomInt(-150, 150),
      openPositions: 1,
    });

    return {
      masterTicket,
      symbol,
      side,
      lots,
      copiedTo: slaves.length,
    };
  }

  async close(masterId: string, masterTicket: string) {
    this.ensureDev();
    const opens = await this.prisma.copyEvent.findMany({
      where: {
        masterAccountId: masterId,
        masterTicket,
        action: CopyAction.OPEN,
      },
    });
    if (opens.length === 0) {
      throw new NotFoundException('No open copy events for that master ticket');
    }

    let closed = 0;
    for (const o of opens) {
      const lots = Number(o.lots);
      const pnl = round2((Math.random() - 0.4) * 200 * lots);
      await this.monitoring.ingestCopyEvent({
        masterAccountId: masterId,
        slaveAccountId: o.slaveAccountId,
        masterTicket,
        slaveTicket: o.slaveTicket ?? undefined,
        symbol: o.symbol,
        side: o.side,
        lots,
        action: CopyAction.CLOSE,
        status: CopyStatus.SUCCESS,
        latencyMs: randomInt(30, 100),
        pnl,
      });
      closed++;
    }
    return { masterTicket, closed };
  }
}

function flip(side: Side): Side {
  return side === Side.BUY ? Side.SELL : Side.BUY;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
