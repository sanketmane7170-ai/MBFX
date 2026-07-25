import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AccountState,
  AddSubscriberInput,
  CopierProvider,
  ProvisionAccountInput,
  SubscriptionRules,
} from './copier.types';

/**
 * Local, dependency-free stand-in for MetaApi + CopyFactory.
 * Generates realistic-looking ids and no-ops the network calls so the whole
 * master/slave management flow can be built and verified without a token.
 * Never receives real broker traffic — swapped for MetaApiCopierProvider in prod.
 */
@Injectable()
export class MockCopierProvider implements CopierProvider {
  private readonly logger = new Logger(MockCopierProvider.name);

  async provisionAccount(
    input: ProvisionAccountInput,
  ): Promise<{ metaapiAccountId: string }> {
    const id = `mock-acc-${randomUUID()}`;
    this.logger.log(
      `provisionAccount ${input.platform} login=${input.login} server=${input.server} → ${id}`,
    );
    return { metaapiAccountId: id };
  }

  async removeAccount(metaapiAccountId: string): Promise<void> {
    this.logger.log(`removeAccount ${metaapiAccountId}`);
  }

  async updateAccountCredentials(
    metaapiAccountId: string,
    changes: { password?: string; server?: string; name?: string },
  ): Promise<void> {
    this.logger.log(
      `updateAccountCredentials ${metaapiAccountId} (${Object.keys(changes).join(', ')})`,
    );
  }

  async createStrategy(input: {
    metaapiAccountId: string;
    name: string;
  }): Promise<{ strategyId: string }> {
    const id = `mock-strat-${randomUUID().slice(0, 8)}`;
    this.logger.log(`createStrategy for ${input.metaapiAccountId} → ${id}`);
    return { strategyId: id };
  }

  async removeStrategy(strategyId: string): Promise<void> {
    this.logger.log(`removeStrategy ${strategyId}`);
  }

  async addSubscriber(
    input: AddSubscriberInput,
  ): Promise<{ subscriberId: string }> {
    const id = `mock-sub-${randomUUID().slice(0, 8)}`;
    this.logger.log(
      `addSubscriber slave=${input.slaveMetaapiAccountId} → strategy=${input.strategyId} ` +
        `(x${input.multiplier}, reverse=${input.reverse}) → ${id}`,
    );
    return { subscriberId: id };
  }

  async updateSubscriber(
    subscriberId: string,
    rules: Partial<SubscriptionRules> & { enabled?: boolean },
  ): Promise<void> {
    this.logger.log(`updateSubscriber ${subscriberId} ${JSON.stringify(rules)}`);
  }

  async removeSubscriber(subscriberId: string): Promise<void> {
    this.logger.log(`removeSubscriber ${subscriberId}`);
  }

  async pauseSubscription(subscriberId: string): Promise<void> {
    this.logger.log(`pauseSubscription ${subscriberId}`);
  }

  async resumeSubscription(subscriberId: string): Promise<void> {
    this.logger.log(`resumeSubscription ${subscriberId}`);
  }

  async closeAll(metaapiAccountId: string): Promise<void> {
    this.logger.log(`closeAll ${metaapiAccountId}`);
  }

  // No live broker connection in the mock — the snapshot poller skips it.
  async getAccountState(_metaapiAccountId: string): Promise<AccountState | null> {
    return null;
  }
}
