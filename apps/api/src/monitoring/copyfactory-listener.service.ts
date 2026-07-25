import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CopyAction, CopyStatus, Side } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MonitoringService } from './monitoring.service';
import { IngestCopyEvent } from './monitoring.types';

/** Routing context resolved from a (strategyId, subscriberId) pair. */
interface RouteCtx {
  receiverAccountId: string;
  copierConfigId: string;
  sourceAccountId: string;
}

/**
 * Turns real CopyFactory copy activity into CopyEvents in our DB + WebSocket feed.
 *
 * Design: poll `historyApi.getSubscriptionTransactions` on a short interval and
 * idempotently upsert each transaction (keyed by its CopyFactory transaction id)
 * into copy_events. Polling — rather than a streaming log listener — means the
 * feed self-heals after restarts/outages (it re-scans a window and backfills)
 * and every row carries the real fields the dashboard needs: lots (`quantity`),
 * latency (`metrics.tradeCopyingLatency`), P/L (`profit`) and the slave ticket
 * (`slavePositionId`). Idle (no-op) until a MetaApi token is configured.
 */
@Injectable()
export class CopyFactoryListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopyFactoryListenerService.name);
  private readonly POLL_MS = 10_000;
  private readonly BACKFILL_MS = 24 * 60 * 60 * 1000; // first poll looks back 24h
  private readonly OVERLAP_MS = 2 * 60 * 1000; // re-scan window to catch late field updates

  private historyApi: any = null;
  private clientKey: string | null = null; // token the client was built for
  private since: Date | null = null; // high-water mark of the last scan
  private timer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
    private readonly monitoring: MonitoringService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.safePoll();
    this.timer = setInterval(() => void this.safePoll(), this.POLL_MS);
    // Don't keep the event loop alive solely for this timer.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async safePoll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.poll();
    } catch (e) {
      this.logger.warn(`CopyFactory poll failed: ${(e as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  private async historyApiClient(): Promise<any | null> {
    const token = this.settings.getToken();
    if (!token) return null;
    if (this.historyApi && this.clientKey === token) return this.historyApi;

    const mod: any = await import('metaapi.cloud-sdk');
    const CopyFactory = mod.CopyFactory ?? (mod.default ?? mod).CopyFactory;
    // No region pin — the history REST API is global and resolves each account's
    // own region server-side (accounts may live outside the configured region).
    const copyFactory = new CopyFactory(token);
    this.historyApi = copyFactory.historyApi;
    this.clientKey = token;
    return this.historyApi;
  }

  private async poll(): Promise<void> {
    if (!this.settings.hasToken()) return;
    const api = await this.historyApiClient();
    if (!api) return;

    // Map (strategyId | subscriberId) -> routing context. Keyed by both so a
    // receiver subscribed to several strategies routes each trade correctly.
    const subs = await this.prisma.subscription.findMany({
      select: {
        copyfactorySubscriberId: true,
        receiverAccountId: true,
        copierConfigId: true,
        copierConfig: { select: { sourceAccountId: true, copyfactoryStrategyId: true } },
      },
    });
    if (!subs.length) return;

    const routes = new Map<string, RouteCtx>();
    for (const s of subs) {
      const key = `${s.copierConfig.copyfactoryStrategyId}|${s.copyfactorySubscriberId}`;
      routes.set(key, {
        receiverAccountId: s.receiverAccountId,
        copierConfigId: s.copierConfigId,
        sourceAccountId: s.copierConfig.sourceAccountId,
      });
    }

    const now = new Date();
    const from = this.since
      ? new Date(this.since.getTime() - this.OVERLAP_MS)
      : new Date(now.getTime() - this.BACKFILL_MS);

    const txns: any[] = (await api.getSubscriptionTransactions(from, now)) ?? [];
    let ingested = 0;
    for (const t of txns) {
      const strategyId = t?.strategy?.id ?? t?.strategy?._id;
      const ctx = routes.get(`${strategyId}|${t?.subscriberId}`);
      if (!ctx) continue; // a transaction we don't manage / can't attribute
      const evt = this.toEvent(t, ctx);
      if (!evt) continue;
      await this.monitoring.upsertCopyEvent(evt);
      ingested++;
    }
    this.since = now;
    if (ingested) this.logger.log(`Synced ${ingested} copy transaction(s) from CopyFactory`);
  }

  /** Map a CopyFactoryTransaction onto our CopyEvent shape. */
  private toEvent(t: any, ctx: RouteCtx): IngestCopyEvent | null {
    const symbol: string | undefined = t?.symbol;
    if (!symbol) return null;

    // Only trade deals (skip balance/credit/correction transactions).
    const type = String(t?.type ?? '').toUpperCase();
    if (!/BUY|SELL/.test(type)) return null;
    const side: Side = type.includes('SELL') ? Side.SELL : Side.BUY;

    // Transaction id is "<dealId>:open" | "<dealId>:close".
    const rawId = String(t?.id ?? '');
    const action: CopyAction = /:close$/i.test(rawId) ? CopyAction.CLOSE : CopyAction.OPEN;

    const lots = Math.abs(Number(t?.quantity ?? 0)) || 0;
    const latencyRaw = t?.metrics?.tradeCopyingLatency;
    const latencyMs =
      latencyRaw != null && Number.isFinite(Number(latencyRaw))
        ? Math.round(Number(latencyRaw))
        : undefined;
    const pnl = t?.profit != null && Number.isFinite(Number(t.profit)) ? Number(t.profit) : undefined;

    return {
      externalId: rawId || undefined,
      copierConfigId: ctx.copierConfigId,
      sourceAccountId: ctx.sourceAccountId,
      receiverAccountId: ctx.receiverAccountId,
      sourceTicket: String(t?.positionId ?? rawId),
      receiverTicket: t?.slavePositionId ? String(t.slavePositionId) : undefined,
      symbol,
      side,
      lots,
      action,
      status: CopyStatus.SUCCESS,
      latencyMs,
      pnl,
      ts: t?.time ? new Date(t.time) : undefined,
    };
  }
}
