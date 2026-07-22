import { CopyAction, CopyStatus, Side } from '@prisma/client';

/** A copy event to ingest (simulation now, CopyFactory listeners later). */
export interface IngestCopyEvent {
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
}

/** An account balance/equity snapshot to ingest. */
export interface IngestSnapshot {
  accountId: string;
  balance: number;
  equity: number;
  margin?: number;
  openPositions?: number;
}
