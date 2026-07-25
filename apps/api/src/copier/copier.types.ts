import { Platform, SizingMode } from '@prisma/client';

/** DI token for the active copier provider (mock locally, MetaApi in prod). */
export const COPIER_PROVIDER = Symbol('COPIER_PROVIDER');

export interface SymbolMap {
  from: string;
  to: string;
}

export interface ProvisionAccountInput {
  name: string;
  login: string;
  /** Trade password — forwarded to MetaApi, never persisted by us. */
  password: string;
  server: string;
  platform: Platform;
}

export interface SubscriptionRules {
  /** How receiver lot size is derived. For FIXED_LOT, `multiplier` is the lot count. */
  sizingMode: SizingMode;
  multiplier: number;
  reverse: boolean;
  copySl: boolean;
  copyTp: boolean;
  symbolMapping?: SymbolMap[];
}

export interface AddSubscriberInput extends SubscriptionRules {
  /** MetaApi account id of the slave. */
  slaveMetaapiAccountId: string;
  /** CopyFactory strategy id of the master to follow. */
  strategyId: string;
}

/**
 * Abstraction over the copy engine. Two implementations:
 *  - MockCopierProvider   (local dev / tests — no external calls)
 *  - MetaApiCopierProvider (real MetaApi + CopyFactory, requires METAAPI_TOKEN)
 */
export interface CopierProvider {
  /** Provision a MetaTrader account connection. Returns its MetaApi account id. */
  provisionAccount(input: ProvisionAccountInput): Promise<{ metaapiAccountId: string }>;
  removeAccount(metaapiAccountId: string): Promise<void>;

  /** Rotate broker credentials / server / name on an existing MetaApi account. */
  updateAccountCredentials(
    metaapiAccountId: string,
    changes: { password?: string; server?: string; name?: string },
  ): Promise<void>;

  /** Create a CopyFactory strategy (master). Returns its strategy id. */
  createStrategy(input: {
    metaapiAccountId: string;
    name: string;
  }): Promise<{ strategyId: string }>;
  removeStrategy(strategyId: string): Promise<void>;

  /** Subscribe a slave to a master's strategy. Returns the subscriber id. */
  addSubscriber(input: AddSubscriberInput): Promise<{ subscriberId: string }>;
  updateSubscriber(
    subscriberId: string,
    rules: Partial<SubscriptionRules> & { enabled?: boolean },
  ): Promise<void>;
  removeSubscriber(subscriberId: string): Promise<void>;

  pauseSubscription(subscriberId: string): Promise<void>;
  resumeSubscription(subscriberId: string): Promise<void>;

  /** Emergency: close all open positions on an account. */
  closeAll(metaapiAccountId: string): Promise<void>;
}
