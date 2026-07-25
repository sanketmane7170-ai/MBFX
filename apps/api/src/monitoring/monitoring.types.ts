import { CopyAction, CopyStatus, Side } from '@prisma/client';

/** A copy event to ingest (from real CopyFactory transactions or simulation). */
export interface IngestCopyEvent {
  /** Stable dedup key (e.g. CopyFactory transaction id "2048676112:open"). */
  externalId?: string;
  copierConfigId?: string;
  sourceAccountId: string;
  receiverAccountId: string;
  sourceTicket: string;
  receiverTicket?: string;
  symbol: string;
  side: Side;
  lots: number;
  sl?: number;
  tp?: number;
  action: CopyAction;
  status?: CopyStatus;
  latencyMs?: number;
  pnl?: number;
  /** Event time (defaults to now when omitted). */
  ts?: Date;
}

/** An account balance/equity snapshot to ingest. */
export interface IngestSnapshot {
  accountId: string;
  balance: number;
  equity: number;
  margin?: number;
  openPositions?: number;
}
