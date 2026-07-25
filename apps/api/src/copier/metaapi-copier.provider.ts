import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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

  async provisionAccount(input: ProvisionAccountInput): Promise<{ metaapiAccountId: string }> {
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
  }

  async removeAccount(metaapiAccountId: string): Promise<void> {
    const { metaApi } = await this.getClients();
    const account = await metaApi.metatraderAccountApi.getAccount(metaapiAccountId);
    await account.undeploy().catch(() => undefined);
    await account.remove();
  }

  async createStrategy(input: {
    metaapiAccountId: string;
    name: string;
  }): Promise<{ strategyId: string }> {
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
  }

  async removeStrategy(strategyId: string): Promise<void> {
    const { copyFactory } = await this.getClients();
    await copyFactory.configurationApi.removeStrategy(strategyId);
  }

  async addSubscriber(input: AddSubscriberInput): Promise<{ subscriberId: string }> {
    const { copyFactory } = await this.getClients();
    const cfg = copyFactory.configurationApi;
    // In CopyFactory the subscriber id is the slave's MetaApi account id.
    await cfg.updateSubscriber(input.slaveMetaapiAccountId, {
      name: 'slave',
      subscriptions: [this.buildSubscription(input)],
    });
    return { subscriberId: input.slaveMetaapiAccountId };
  }

  async updateSubscriber(
    subscriberId: string,
    rules: Partial<SubscriptionRules> & { enabled?: boolean },
  ): Promise<void> {
    const { copyFactory } = await this.getClients();
    const cfg = copyFactory.configurationApi;
    const existing = await cfg.getSubscriber(subscriberId).catch(() => null);
    const subs: any[] = existing?.subscriptions ?? [];
    const updated = subs.map((s) => ({
      ...s,
      ...(rules.multiplier != null ? { multiplier: rules.multiplier } : {}),
      ...(rules.reverse != null ? { reverse: rules.reverse } : {}),
      ...(rules.symbolMapping
        ? { symbolMapping: rules.symbolMapping.map((m) => ({ from: m.from, to: m.to })) }
        : {}),
      ...(rules.enabled != null ? { paused: !rules.enabled } : {}),
    }));
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
    const subscription: any = { strategyId: input.strategyId, multiplier: input.multiplier };
    if (input.reverse) subscription.reverse = true;
    if (input.symbolMapping?.length) {
      subscription.symbolMapping = input.symbolMapping.map((m) => ({ from: m.from, to: m.to }));
    }
    return subscription;
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
