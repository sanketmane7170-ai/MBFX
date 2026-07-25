import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CopyAction, CopyStatus, SizingMode, Side } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MonitoringService } from './monitoring.service';
import { SimulateOpenDto } from './dto/simulate-open.dto';

/**
 * DEV-ONLY driver mimicking CopyFactory: a source trade fans out to every
 * enabled receiver in a copier config, producing copy events that flow through
 * MonitoringService → DB + WebSocket. Disabled when a real MetaApi token is set.
 */
@Injectable()
export class SimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoring: MonitoringService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  private ensureDev(): void {
    // Disabled whenever a real MetaApi token is active — whether set via env OR
    // saved in Settings (DB). Also hard-off in production regardless of token.
    const envToken = this.config.get<string>('METAAPI_TOKEN');
    const prod = this.config.get<string>('NODE_ENV') === 'production';
    if (prod || (envToken && envToken.trim().length > 0) || this.settings.hasToken()) {
      throw new ForbiddenException(
        'Simulation is disabled while the real MetaApi provider is active.',
      );
    }
  }

  private static computeLots(
    mode: SizingMode,
    sourceLots: number,
    multiplier: number,
    balanceRatio = 1,
  ): number {
    switch (mode) {
      case SizingMode.FIXED_LOT:
        return round2(multiplier);
      case SizingMode.MULTIPLIER:
        return round2(sourceLots * multiplier);
      case SizingMode.BALANCE_RATIO:
        return round2(sourceLots * balanceRatio);
      default:
        return round2(sourceLots);
    }
  }

  /** Latest known balance for an account (from snapshots), for balance-ratio sizing. */
  private async balanceOf(accountId: string): Promise<number | null> {
    const snap = await this.prisma.accountSnapshot.findFirst({
      where: { accountId },
      orderBy: { ts: 'desc' },
      select: { balance: true },
    });
    return snap ? Number(snap.balance) : null;
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

  async open(configId: string, dto: SimulateOpenDto) {
    this.ensureDev();
    const config = await this.prisma.copierConfig.findUnique({
      where: { id: configId },
      include: {
        subscriptions: { where: { enabled: true }, include: { receiverAccount: true } },
      },
    });
    if (!config) throw new NotFoundException('Copier not found');

    const symbol = dto.symbol ?? 'EURUSD';
    const side = dto.side ?? Side.BUY;
    const lots = dto.lots ?? 1.0;
    const sourceTicket = dto.sourceTicket ?? String(randomInt(10_000_000, 99_999_999));

    const sourceBalance = (await this.balanceOf(config.sourceAccountId)) ?? 10_000;

    for (const sub of config.subscriptions) {
      let balanceRatio = 1;
      if (sub.sizingMode === SizingMode.BALANCE_RATIO) {
        const receiverBalance = (await this.balanceOf(sub.receiverAccountId)) ?? sourceBalance;
        balanceRatio = sourceBalance > 0 ? receiverBalance / sourceBalance : 1;
      }
      const receiverLots = SimulationService.computeLots(
        sub.sizingMode,
        lots,
        Number(sub.multiplier),
        balanceRatio,
      );
      const effectiveSide = sub.reverse ? flip(side) : side;
      const mappedSymbol = SimulationService.mapSymbol(sub.symbolMapping, symbol);

      await this.monitoring.ingestCopyEvent({
        copierConfigId: configId,
        sourceAccountId: config.sourceAccountId,
        receiverAccountId: sub.receiverAccountId,
        sourceTicket,
        receiverTicket: `R${randomInt(1_000_000, 9_999_999)}`,
        symbol: mappedSymbol,
        side: effectiveSide,
        lots: receiverLots,
        sl: sub.copySl ? dto.sl : undefined,
        tp: sub.copyTp ? dto.tp : undefined,
        action: CopyAction.OPEN,
        status: CopyStatus.SUCCESS,
        latencyMs: randomInt(30, 140),
      });
    }

    await this.monitoring.ingestSnapshot({
      accountId: config.sourceAccountId,
      balance: 10_000,
      equity: 10_000 + randomInt(-150, 150),
      openPositions: 1,
    });

    return { sourceTicket, symbol, side, lots, copiedTo: config.subscriptions.length };
  }

  async close(configId: string, sourceTicket: string) {
    this.ensureDev();
    const opens = await this.prisma.copyEvent.findMany({
      where: { copierConfigId: configId, sourceTicket, action: CopyAction.OPEN },
    });
    if (opens.length === 0) {
      throw new NotFoundException('No open copy events for that source ticket');
    }

    let closed = 0;
    for (const o of opens) {
      const lots = Number(o.lots);
      const pnl = round2((Math.random() - 0.4) * 200 * lots);
      await this.monitoring.ingestCopyEvent({
        copierConfigId: configId,
        sourceAccountId: o.sourceAccountId,
        receiverAccountId: o.receiverAccountId,
        sourceTicket,
        receiverTicket: o.receiverTicket ?? undefined,
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
    return { sourceTicket, closed };
  }
}

function flip(side: Side): Side {
  return side === Side.BUY ? Side.SELL : Side.BUY;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
