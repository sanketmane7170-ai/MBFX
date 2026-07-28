import { Platform, SizingMode, SymbolFilterMode } from '@prisma/client';

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
  // Trade filters (mapped to CopyFactory symbolFilter + min/max trade volume).
  symbolFilterMode?: SymbolFilterMode;
  symbolFilterList?: string[];
  minVolume?: number;
  maxVolume?: number;
}

export interface AddSubscriberInput extends SubscriptionRules {
  /** MetaApi account id of the slave. */
  slaveMetaapiAccountId: string;
  /** CopyFactory strategy id of the master to follow. */
  strategyId: string;
}

/** Live financials + connection state of a MetaTrader account. */
export interface AccountState {
  balance: number;
  equity: number;
  margin: number;
  openPositions: number;
  connected: boolean;
  /** ACCOUNT_MARGIN_MODE_RETAIL_NETTING | ..._HEDGING (broker-set), if known. */
  marginMode?: string | null;
}

/** A single open position on a MetaTrader account. */
export interface OpenPosition {
  id: string;
  symbol: string;
  /** 'BUY' | 'SELL' (normalized from MetaApi POSITION_TYPE_*). */
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  swap: number;
  profit: number;
  time: string | null;
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

  /**
   * Live balance/equity/margin/open-positions for an account, for periodic
   * snapshots + connection reconciliation. Returns null when unavailable
   * (e.g. the mock provider, or no live data).
   */
  getAccountState(metaapiAccountId: string): Promise<AccountState | null>;

  /** Current open positions on an account (empty for the mock provider). */
  getOpenPositions(metaapiAccountId: string): Promise<OpenPosition[]>;
}
