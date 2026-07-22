-- CreateEnum
CREATE TYPE "Side" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "CopyAction" AS ENUM ('OPEN', 'CLOSE', 'MODIFY');

-- CreateEnum
CREATE TYPE "CopyStatus" AS ENUM ('SUCCESS', 'FAILED', 'FILTERED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('MASTER', 'SLAVE');

-- CreateTable
CREATE TABLE "copy_events" (
    "id" TEXT NOT NULL,
    "masterAccountId" TEXT NOT NULL,
    "slaveAccountId" TEXT NOT NULL,
    "masterTicket" TEXT NOT NULL,
    "slaveTicket" TEXT,
    "symbol" TEXT NOT NULL,
    "side" "Side" NOT NULL,
    "lots" DECIMAL(65,30) NOT NULL,
    "sl" DECIMAL(65,30),
    "tp" DECIMAL(65,30),
    "action" "CopyAction" NOT NULL,
    "status" "CopyStatus" NOT NULL DEFAULT 'SUCCESS',
    "latencyMs" INTEGER,
    "pnl" DECIMAL(65,30),
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copy_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_snapshots" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL,
    "equity" DECIMAL(65,30) NOT NULL,
    "margin" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "openPositions" INTEGER NOT NULL DEFAULT 0,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copy_events_masterAccountId_ts_idx" ON "copy_events"("masterAccountId", "ts");

-- CreateIndex
CREATE INDEX "copy_events_slaveAccountId_ts_idx" ON "copy_events"("slaveAccountId", "ts");

-- CreateIndex
CREATE INDEX "copy_events_masterTicket_idx" ON "copy_events"("masterTicket");

-- CreateIndex
CREATE INDEX "account_snapshots_accountId_ts_idx" ON "account_snapshots"("accountId", "ts");
