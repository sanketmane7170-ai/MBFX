import { AccountType, CopyAction, CopyStatus, Side } from '@prisma/client';

/** A copy event to ingest (from the simulation now, from CopyFactory listeners later). */
export interface IngestCopyEvent {
  masterAccountId: string;
  slaveAccountId: string;
  masterTicket: string;
  slaveTicket?: string;
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
  accountType: AccountType;
  balance: number;
  equity: number;
  margin?: number;
  openPositions?: number;
}
