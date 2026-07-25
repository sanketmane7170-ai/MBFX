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
    this.logger.error(`${label} failed: ${raw}`);
    // Strip MetaApi's "(request-id). Request URL: ..." suffix.
    const clean = raw.split(/\s*\(/)[0].trim() || raw;
    throw new BadRequestException(clean);
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
   * the CopyFactory subscription schema; the SL/TP + trade-size-scaling shapes
   * are confirmed during the Phase 0 live spike (see class header).
   */
  private applyRules(
    subscription: any,
    rules: Partial<SubscriptionRules> & { enabled?: boolean },
  ): void {
    if (rules.multiplier != null) subscription.multiplier = rules.multiplier;
    if (rules.reverse != null) subscription.reverse = rules.reverse;
    if (rules.enabled != null) subscription.paused = !rules.enabled;
    if (rules.symbolMapping) {
      subscription.symbolMapping = rules.symbolMapping.map((m) => ({ from: m.from, to: m.to }));
    }

    // Lot sizing → CopyFactory trade-size scaling.
    if (rules.sizingMode === SizingMode.BALANCE_RATIO) {
      subscription.tradeSizeScalingMode = 'balance'; // proportional to relative balances
    } else if (rules.sizingMode === SizingMode.FIXED_LOT) {
      subscription.tradeSizeScalingMode = 'none'; // `multiplier` carries the fixed lot size
    } else if (rules.sizingMode === SizingMode.MULTIPLIER) {
      subscription.tradeSizeScalingMode = 'none';
    }

    // SL/TP mirroring — strip on the receiver when copying is disabled.
    if (rules.copySl === false) subscription.removeStopLoss = true;
    else if (rules.copySl === true) subscription.removeStopLoss = false;
    if (rules.copyTp === false) subscription.removeTakeProfit = true;
    else if (rules.copyTp === true) subscription.removeTakeProfit = false;
  }

  private async setPaused(subscriberId: string, paused: boolean): Promise<void> {
    const { copyFactory } = await this.getClients();
    const cfg = copyFactory.configurationApi;
    const existing = await cfg.getSubscriber(subscriberId).catch(() => null);
    if (!existing) return;
    const subs: any[] = (existing.subscriptions ?? []).map((s: any) => ({ ...s, paused }));
    await cfg.updateSubscriber(subscriberId, { name: existing.name ?? 'slave', subscriptions: subs });
  }
}
