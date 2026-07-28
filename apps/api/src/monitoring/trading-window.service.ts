import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { COPIER_PROVIDER, CopierProvider } from '../copier/copier.types';

/**
 * Enforces per-receiver trading-hours windows. CopyFactory has no native
 * time filter and we're not in the execution path, so we pause the subscription
 * (closeOnly — stops opening NEW copied trades) outside the window and resume it
 * inside. Runs every minute. Only manages enabled receivers, so a manual pause
 * always wins. Idle until a MetaApi token is set.
 */
@Injectable()
export class TradingWindowService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TradingWindowService.name);
  private readonly TICK_MS = 60_000;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  /** subId -> last-applied paused state, for change-only logging. */
  private state = new Map<string, boolean>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    @Inject(COPIER_PROVIDER) private readonly copier: CopierProvider,
  ) {}

  onModuleInit(): void {
    void this.safeTick();
    this.timer = setInterval(() => void this.safeTick(), this.TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** True when nowMin (minutes-of-day UTC) is inside [start, end), handling overnight wrap. */
  static inWindow(nowMin: number, start: number, end: number): boolean {
    if (start === end) return true; // degenerate window → always on
    return start < end ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end;
  }

  private async safeTick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.tick();
    } catch (e) {
      this.logger.warn(`Trading-window tick failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async tick(): Promise<void> {
    if (!this.settings.hasToken()) return;

    const subs = await this.prisma.subscription.findMany({
      where: {
        enabled: true,
        tradeWindowStart: { not: null },
        tradeWindowEnd: { not: null },
        copierConfig: { enabled: true },
      },
      select: {
        id: true,
        copyfactorySubscriberId: true,
        tradeWindowStart: true,
        tradeWindowEnd: true,
      },
    });

    const now = new Date();
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    const live = new Set(subs.map((s) => s.id));

    for (const s of subs) {
      const inside = TradingWindowService.inWindow(nowMin, s.tradeWindowStart!, s.tradeWindowEnd!);
      const shouldPause = !inside;
      try {
        // Idempotent: pauseSubscription/resumeSubscription just set/clear closeOnly.
        if (shouldPause) await this.copier.pauseSubscription(s.copyfactorySubscriberId);
        else await this.copier.resumeSubscription(s.copyfactorySubscriberId);
        if (this.state.get(s.id) !== shouldPause) {
          this.logger.log(
            `Receiver ${s.id} ${shouldPause ? 'paused (outside' : 'resumed (inside'} trading window)`,
          );
          this.state.set(s.id, shouldPause);
        }
      } catch (e) {
        this.logger.warn(`Trading-window toggle for ${s.id} failed: ${(e as Error).message}`);
      }
    }

    for (const id of this.state.keys()) if (!live.has(id)) this.state.delete(id);
  }
}
