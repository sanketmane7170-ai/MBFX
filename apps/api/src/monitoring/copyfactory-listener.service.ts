import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CopyAction, CopyStatus, Side } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MonitoringService } from './monitoring.service';

/**
 * Turns real CopyFactory copy activity into CopyEvents in our DB + WebSocket feed.
 *
 * Design: a periodic re-sync registers a CopyFactory subscriber-log listener for
 * every active receiver, and drops listeners for receivers that are gone. The
 * re-sync doubles as reconnection/heartbeat — a dropped stream is simply
 * re-registered on the next tick. Idle (no-op) until a MetaApi token is set.
 *
 * NOTE: the CopyFactory SDK record/method shapes accessed here are typed loosely
 * and must be confirmed against a live token during the Phase 0 spike (same
 * caveat as MetaApiCopierProvider). Until then this is wired but unverified.
 */
@Injectable()
export class CopyFactoryListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopyFactoryListenerService.name);
  private readonly SYNC_MS = 60_000;

  private tradingApi: any = null;
  private clientKey: string | null = null; // token|region the client was built for
  private readonly listeners = new Map<string, string>(); // subscriberId -> listenerId
  private timer: NodeJS.Timeout | null = null;
  private syncing = false;

  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
    private readonly monitoring: MonitoringService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Kick an initial sync, then re-sync on an interval (also our reconnect loop).
    await this.safeSync();
    this.timer = setInterval(() => void this.safeSync(), this.SYNC_MS);
    // Don't keep the event loop alive solely for this timer.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeSync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      await this.sync();
    } catch (e) {
      this.logger.warn(`CopyFactory listener sync failed: ${(e as Error).message}`);
    } finally {
      this.syncing = false;
    }
  }

  private async tradingApiClient(): Promise<any | null> {
    const token = this.settings.getToken();
    if (!token) return null;
    const region = this.settings.getRegion();
    const key = `${token}|${region}`;
    if (this.tradingApi && this.clientKey === key) return this.tradingApi;

    const mod: any = await import('metaapi.cloud-sdk');
    const CopyFactory = mod.CopyFactory ?? (mod.default ?? mod).CopyFactory;
    const copyFactory = new CopyFactory(token, { region });
    this.tradingApi = copyFactory.tradingApi ?? copyFactory.userLogApi;
    this.clientKey = key;
    this.listeners.clear(); // token changed → old listener ids are invalid
    return this.tradingApi;
  }

  private async sync(): Promise<void> {
    if (!this.settings.hasToken()) {
      // Token cleared → tear down any listeners and go idle.
      if (this.listeners.size) await this.teardown();
      return;
    }
    const api = await this.tradingApiClient();
    if (!api) return;

    const subs = await this.prisma.subscription.findMany({
      where: { enabled: true, copierConfig: { enabled: true } },
      select: {
        copyfactorySubscriberId: true,
        receiverAccountId: true,
        copierConfigId: true,
        copierConfig: { select: { sourceAccountId: true } },
      },
    });

    const wanted = new Set(subs.map((s) => s.copyfactorySubscriberId));

    // Register listeners for newly-active receivers.
    for (const s of subs) {
      if (this.listeners.has(s.copyfactorySubscriberId)) continue;
      try {
        const ctx = {
          subscriberId: s.copyfactorySubscriberId,
          receiverAccountId: s.receiverAccountId,
          sourceAccountId: s.copierConfig.sourceAccountId,
          copierConfigId: s.copierConfigId,
        };
        const listener = {
          onUserLog: async (records: any[]) => {
            for (const r of records ?? []) await this.handleRecord(r, ctx);
          },
        };
        const listenerId = await api.addSubscriberLogListener(
          listener,
          s.copyfactorySubscriberId,
        );
        this.listeners.set(s.copyfactorySubscriberId, listenerId ?? s.copyfactorySubscriberId);
        this.logger.log(`Listening to CopyFactory subscriber ${s.copyfactorySubscriberId}`);
      } catch (e) {
        this.logger.warn(`addSubscriberLogListener failed: ${(e as Error).message}`);
      }
    }

    // Drop listeners for receivers that are no longer active.
    for (const [subscriberId, listenerId] of this.listeners) {
      if (wanted.has(subscriberId)) continue;
      await api.removeSubscriberLogListener?.(listenerId).catch(() => undefined);
      this.listeners.delete(subscriberId);
    }
  }

  private async teardown(): Promise<void> {
    const api = this.tradingApi;
    if (api) {
      for (const listenerId of this.listeners.values()) {
        await api.removeSubscriberLogListener?.(listenerId).catch(() => undefined);
      }
    }
    this.listeners.clear();
  }

  /**
   * Maps a CopyFactory subscriber-log record to a CopyEvent. Record fields are
   * best-effort and defensive — confirm exact shapes in the Phase 0 spike.
   */
  private async handleRecord(
    record: any,
    ctx: {
      subscriberId: string;
      receiverAccountId: string;
      sourceAccountId: string;
      copierConfigId: string;
    },
  ): Promise<void> {
    // Only act on records that represent a copied trade (open/close), not chatter.
    const type: string = (record?.type ?? record?.operation ?? '').toString().toLowerCase();
    const isClose = /close|exit/.test(type);
    const isOpen = /open|entry|market/.test(type);
    if (!isOpen && !isClose) return;

    const level: string = (record?.level ?? 'info').toString().toLowerCase();
    const status = level === 'error' ? CopyStatus.FAILED : CopyStatus.SUCCESS;

    const symbol: string | undefined = record?.symbol ?? record?.positionSymbol;
    if (!symbol) return;

    const rawSide = (record?.side ?? record?.positionType ?? record?.type ?? '').toString().toUpperCase();
    const side: Side = rawSide.includes('SELL') ? Side.SELL : Side.BUY;
    const lots = Number(record?.volume ?? record?.lots ?? record?.positionVolume ?? 0);

    await this.monitoring.ingestCopyEvent({
      copierConfigId: ctx.copierConfigId,
      sourceAccountId: ctx.sourceAccountId,
      receiverAccountId: ctx.receiverAccountId,
      sourceTicket: String(record?.signalPositionId ?? record?.positionId ?? record?.id ?? Date.now()),
      receiverTicket: record?.positionId ? String(record.positionId) : undefined,
      symbol,
      side,
      lots: Number.isFinite(lots) ? lots : 0,
      action: isClose ? CopyAction.CLOSE : CopyAction.OPEN,
      status,
    });
  }
}
