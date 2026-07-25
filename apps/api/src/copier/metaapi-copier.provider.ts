import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SizingMode } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';
import {
  AddSubscriberInput,
  CopierProvider,
  ProvisionAccountInput,
  SubscriptionRules,
} from './copier.types';

/**
 * Real MetaApi + CopyFactory provider.
 *
 * Active whenever a MetaApi token is configured (Settings or env). The SDK is
 * accessed with loose typing and validated live, not at compile time — the exact
 * call shapes must be confirmed during the first run against a real token +
 * demo accounts (Phase 0 spike). Until then it is wired but unverified.
 */
@Injectable()
export class MetaApiCopierProvider implements CopierProvider {
  private readonly logger = new Logger(MetaApiCopierProvider.name);
  private clients: { token: string; region: string; metaApi: any; copyFactory: any } | null = null;

  constructor(private readonly settings: SettingsService) {}

  private async getClients(): Promise<{ metaApi: any; copyFactory: any; region: string }> {
    const token = this.settings.getToken();
    const region = this.settings.getRegion();
    if (!token) {
      throw new ServiceUnavailableException(
        'MetaApi token is not configured. Set it in Settings first.',
      );
    }
    if (this.clients && this.clients.token === token && this.clients.region === region) {
      return this.clients;
    }
    const mod: any = await import('metaapi.cloud-sdk');
    const MetaApi = mod.default ?? mod;
    const CopyFactory = mod.CopyFactory ?? MetaApi.CopyFactory;
    this.clients = {
      token,
      region,
      metaApi: new MetaApi(token, { region }),
      copyFactory: new CopyFactory(token, { region }),
    };
    return this.clients;
  }

  /** Translate a raw MetaApi/SDK error into a clean 400 with a readable message. */
  private fail(label: string, e: unknown): never {
    if (e instanceof HttpException) throw e;
    const raw = e instanceof Error ? e.message : String(e);
    // MetaApi's ValidationError carries a `details` array explaining exactly
    // which field failed — without it the message is just "Validation failed".
    const detailText = MetaApiCopierProvider.formatDetails((e as any)?.details);
    this.logger.error(
      `${label} failed: ${raw}${detailText ? ` | details: ${detailText}` : ''}`,
    );
    // Strip MetaApi's "(request-id). Request URL: ..." suffix.
    const clean = raw.split(/\s*\(/)[0].trim() || raw;
    const message = detailText ? `${clean}: ${detailText}` : clean;
    throw new BadRequestException(message);
  }

  /** Flatten a MetaApi error `details` payload into a readable one-liner. */
  private static formatDetails(details: unknown): string {
    if (!details) return '';
    const arr = Array.isArray(details) ? details : [details];
    return arr
      .map((d) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          const o = d as Record<string, unknown>;
          const field = o.parameter ?? o.property ?? o.path ?? o.field;
          const msg = o.message ?? o.error ?? JSON.stringify(o);
          return field ? `${String(field)} — ${String(msg)}` : String(msg);
        }
        return String(d);
      })
      .filter(Boolean)
      .join('; ');
  }

  async provisionAccount(input: ProvisionAccountInput): Promise<{ metaapiAccountId: string }> {
    try {
    const { metaApi, region } = await this.getClients();
    const account = await metaApi.metatraderAccountApi.createAccount({
      name: input.name,
      type: 'cloud-g2',
      login: input.login,
      password: input.password,
      server: input.server,
      platform: input.platform.toLowerCase(),
      magic: 0,
      reliability: 'high',
      region,
      // Enable both roles so any account can be a source (strategy) and/or a
      // receiver (subscriber) in CopyFactory. Required for copying to work.
      copyFactoryRoles: ['SUBSCRIBER', 'PROVIDER'],
    });
    await account.deploy();
    await account.waitConnected();
    this.logger.log(`Provisioned MetaApi account ${account.id} (${input.login}@${input.server})`);
    return { metaapiAccountId: account.id };
    } catch (e) {
      this.fail('provisionAccount', e);
    }
  }

  async removeAccount(metaapiAccountId: string): Promise<void> {
    const { metaApi } = await this.getClients();
    const account = await metaApi.metatraderAccountApi.getAccount(metaapiAccountId);
    await account.undeploy().catch(() => undefined);
    await account.remove();
  }

  async updateAccountCredentials(
    metaapiAccountId: string,
    changes: { password?: string; server?: string; name?: string },
  ): Promise<void> {
    const { metaApi } = await this.getClients();
    const account = await metaApi.metatraderAccountApi.getAccount(metaapiAccountId);
    // SDK call shape confirmed live during Phase 0 spike (see class header).
    await account.update({
      ...(changes.name != null ? { name: changes.name } : {}),
      ...(changes.password != null ? { password: changes.password } : {}),
      ...(changes.server != null ? { server: changes.server } : {}),
    });
  }

  async createStrategy(input: {
    metaapiAccountId: string;
    name: string;
  }): Promise<{ strategyId: string }> {
    try {
      const { copyFactory } = await this.getClients();
      const cfg = copyFactory.configurationApi;
      const generated = await cfg.generateStrategyId();
      const strategyId = generated.id ?? generated;
      await cfg.updateStrategy(strategyId, {
        name: input.name,
        description: input.name, // required by CopyFactory
        accountId: input.metaapiAccountId,
      });
      return { strategyId };
    } catch (e) {
      this.fail('createStrategy', e);
    }
  }

  async removeStrategy(strategyId: string): Promise<void> {
    const { copyFactory } = await this.getClients();
    await copyFactory.configurationApi.removeStrategy(strategyId);
  }

  async addSubscriber(input: AddSubscriberInput): Promise<{ subscriberId: string }> {
    try {
      const { copyFactory } = await this.getClients();
      const cfg = copyFactory.configurationApi;
      // In CopyFactory the subscriber id is the slave's MetaApi account id.
      await cfg.updateSubscriber(input.slaveMetaapiAccountId, {
        name: 'slave',
        subscriptions: [this.buildSubscription(input)],
      });
      return { subscriberId: input.slaveMetaapiAccountId };
    } catch (e) {
      this.fail('addSubscriber', e);
    }
  }

  async updateSubscriber(
    subscriberId: string,
    rules: Partial<SubscriptionRules> & { enabled?: boolean },
  ): Promise<void> {
    const { copyFactory } = await this.getClients();
    const cfg = copyFactory.configurationApi;
    const existing = await cfg.getSubscriber(subscriberId).catch(() => null);
    const subs: any[] = existing?.subscriptions ?? [];
    const updated = subs.map((s) => {
      const next = { ...s };
      this.applyRules(next, rules);
      return next;
    });
    await cfg.updateSubscriber(subscriberId, {
      name: existing?.name ?? 'slave',
      subscriptions: updated,
    });
  }

  async removeSubscriber(subscriberId: string): Promise<void> {
    const { copyFactory } = await this.getClients();
    await copyFactory.configurationApi.removeSubscriber(subscriberId);
  }

  async pauseSubscription(subscriberId: string): Promise<void> {
    await this.setPaused(subscriberId, true);
  }
  async resumeSubscription(subscriberId: string): Promise<void> {
    await this.setPaused(subscriberId, false);
  }

  async closeAll(metaapiAccountId: string): Promise<void> {
    const { metaApi } = await this.getClients();
    const account = await metaApi.metatraderAccountApi.getAccount(metaapiAccountId);
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    const positions: any[] = await connection.getPositions();
    for (const p of positions) {
      await connection.closePosition(p.id, {}).catch(() => undefined);
    }
    await connection.close?.();
  }

  private buildSubscription(input: AddSubscriberInput): any {
    const subscription: any = { strategyId: input.strategyId };
    this.applyRules(subscription, input);
    return subscription;
  }

  /**
   * Maps our rule set onto a CopyFactory subscription. Field names below match
   * the CopyFactory v11 subscription schema (CopyFactoryStrategySubscription):
   * trade sizing is the `tradeSizeScaling` object, SL/TP are `copyStopLoss` /
   * `copyTakeProfit` booleans. There is no `paused` field — enable/disable maps
   * to `closeOnly`, which stops opening new copied positions.
   */
  private applyRules(
    subscription: any,
    rules: Partial<SubscriptionRules> & { enabled?: boolean },
  ): void {
    if (rules.reverse != null) subscription.reverse = rules.reverse;
    if (rules.symbolMapping && rules.symbolMapping.length) {
      subscription.symbolMapping = rules.symbolMapping.map((m) => ({ from: m.from, to: m.to }));
    }

    // SL/TP mirroring.
    if (rules.copySl != null) subscription.copyStopLoss = rules.copySl;
    if (rules.copyTp != null) subscription.copyTakeProfit = rules.copyTp;

    // Lot sizing → CopyFactory `tradeSizeScaling` object.
    if (rules.sizingMode != null) {
      const mult = rules.multiplier ?? 1;
      if (rules.sizingMode === SizingMode.BALANCE_RATIO) {
        // Scale proportionally to the relative balances of source/receiver.
        subscription.tradeSizeScaling = { mode: 'balance' };
        subscription.multiplier = 1;
      } else if (rules.sizingMode === SizingMode.FIXED_LOT) {
        // Every copied trade uses a fixed lot size (carried by `multiplier`).
        subscription.tradeSizeScaling = { mode: 'fixedVolume', tradeVolume: mult };
        subscription.multiplier = 1;
      } else {
        // MULTIPLIER — preserve the source volume, then scale by `multiplier`.
        subscription.tradeSizeScaling = { mode: 'none' };
        subscription.multiplier = mult;
      }
    } else if (rules.multiplier != null) {
      subscription.multiplier = rules.multiplier;
    }

    // Enable/disable. CopyFactory has no pause flag; `closeOnly` stops opening
    // new copied positions while keeping the subscription config intact.
    if (rules.enabled === false) subscription.closeOnly = 'by-symbol';
    else if (rules.enabled === true) delete subscription.closeOnly;
  }

  private async setPaused(subscriberId: string, paused: boolean): Promise<void> {
    const { copyFactory } = await this.getClients();
    const cfg = copyFactory.configurationApi;
    const existing = await cfg.getSubscriber(subscriberId).catch(() => null);
    if (!existing) return;
    const subs: any[] = (existing.subscriptions ?? []).map((s: any) => {
      const next = { ...s };
      if (paused) next.closeOnly = 'by-symbol';
      else delete next.closeOnly;
      return next;
    });
    await cfg.updateSubscriber(subscriberId, { name: existing.name ?? 'slave', subscriptions: subs });
  }
}
