import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { MockCopierProvider } from './mock-copier.provider';
import { MetaApiCopierProvider } from './metaapi-copier.provider';
import {
  AddSubscriberInput,
  CopierProvider,
  ProvisionAccountInput,
  SubscriptionRules,
} from './copier.types';

/**
 * Routes each copier call to the real MetaApi provider when a token is
 * configured, otherwise the mock. This lets the app run today (mock) and go
 * live the instant an operator saves a MetaApi token in Settings — no restart.
 */
@Injectable()
export class CopierDispatcher implements CopierProvider {
  private readonly logger = new Logger(CopierDispatcher.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly mock: MockCopierProvider,
    private readonly real: MetaApiCopierProvider,
  ) {}

  private active(): CopierProvider {
    return this.settings.hasToken() ? this.real : this.mock;
  }

  provisionAccount(input: ProvisionAccountInput) {
    return this.active().provisionAccount(input);
  }
  removeAccount(id: string) {
    return this.active().removeAccount(id);
  }
  updateAccountCredentials(
    metaapiAccountId: string,
    changes: { password?: string; server?: string; name?: string },
  ) {
    return this.active().updateAccountCredentials(metaapiAccountId, changes);
  }
  createStrategy(input: { metaapiAccountId: string; name: string }) {
    return this.active().createStrategy(input);
  }
  removeStrategy(strategyId: string) {
    return this.active().removeStrategy(strategyId);
  }
  addSubscriber(input: AddSubscriberInput) {
    return this.active().addSubscriber(input);
  }
  updateSubscriber(subscriberId: string, rules: Partial<SubscriptionRules> & { enabled?: boolean }) {
    return this.active().updateSubscriber(subscriberId, rules);
  }
  removeSubscriber(subscriberId: string) {
    return this.active().removeSubscriber(subscriberId);
  }
  pauseSubscription(subscriberId: string) {
    return this.active().pauseSubscription(subscriberId);
  }
  resumeSubscription(subscriberId: string) {
    return this.active().resumeSubscription(subscriberId);
  }
  closeAll(metaapiAccountId: string) {
    return this.active().closeAll(metaapiAccountId);
  }
}
