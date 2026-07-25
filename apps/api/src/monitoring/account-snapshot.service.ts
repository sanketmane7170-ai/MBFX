import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { COPIER_PROVIDER, CopierProvider } from '../copier/copier.types';
import { MonitoringService } from './monitoring.service';

/**
 * Periodically pulls live balance/equity/margin/open-positions for every account
 * from MetaApi and records an AccountSnapshot, and reconciles Account.status with
 * the real connection state (CONNECTED ↔ ERROR). This is what powers the balance
 * on Account detail, the Overview KPIs, and keeps the status pill honest.
 *
 * Idle (no-op) until a MetaApi token is configured — with the mock provider
 * getAccountState returns null and nothing is written.
 */
@Injectable()
export class AccountSnapshotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountSnapshotService.name);
  private readonly POLL_MS = 60_000;

  private timer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly monitoring: MonitoringService,
    @Inject(COPIER_PROVIDER) private readonly copier: CopierProvider,
  ) {}

  onModuleInit(): void {
    // Fire-and-forget: the first poll opens RPC connections (can take ~1 min),
    // so it must NOT block the app from starting to listen.
    void this.safePoll();
    this.timer = setInterval(() => void this.safePoll(), this.POLL_MS);
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
      this.logger.warn(`Account snapshot poll failed: ${(e as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  private async poll(): Promise<void> {
    if (!this.settings.hasToken()) return;

    const accounts = await this.prisma.account.findMany({
      where: { deletedAt: null },
      select: { id: true, metaapiAccountId: true, status: true },
    });

    for (const a of accounts) {
      if (!a.metaapiAccountId) continue;
      try {
        const st = await this.copier.getAccountState(a.metaapiAccountId);
        if (!st) continue; // mock / no live data
        await this.monitoring.ingestSnapshot({
          accountId: a.id,
          balance: st.balance,
          equity: st.equity,
          margin: st.margin,
          openPositions: st.openPositions,
        });
        await this.reconcile(a.id, a.status, AccountStatus.CONNECTED);
      } catch (e) {
        this.logger.warn(`Snapshot for account ${a.id} failed: ${(e as Error).message}`);
        await this.reconcile(a.id, a.status, AccountStatus.ERROR);
      }
    }
  }

  /**
   * Move status toward the observed value without clobbering a user's manual
   * DISCONNECT. Only flips CONNECTED/PROVISIONING/ERROR among themselves.
   */
  private async reconcile(
    id: string,
    current: AccountStatus,
    observed: AccountStatus,
  ): Promise<void> {
    if (current === observed) return;
    if (current === AccountStatus.DISCONNECTED) return; // respect manual disconnect
    await this.prisma.account.update({ where: { id }, data: { status: observed } });
  }
}
