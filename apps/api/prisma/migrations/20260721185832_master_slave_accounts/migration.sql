-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('MT4', 'MT5');

-- CreateEnum
CREATE TYPE "MasterStatus" AS ENUM ('PROVISIONING', 'CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "SlaveStatus" AS ENUM ('PAUSED', 'COPYING', 'CLOSED', 'ERROR');

-- CreateEnum
CREATE TYPE "SizingMode" AS ENUM ('FIXED_LOT', 'MULTIPLIER', 'BALANCE_RATIO');

-- CreateTable
CREATE TABLE "master_accounts" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metaapiAccountId" TEXT NOT NULL,
    "copyfactoryStrategyId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "MasterStatus" NOT NULL DEFAULT 'PROVISIONING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slave_accounts" (
    "id" TEXT NOT NULL,
    "masterAccountId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metaapiAccountId" TEXT NOT NULL,
    "copyfactorySubscriberId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "sizingMode" "SizingMode" NOT NULL DEFAULT 'MULTIPLIER',
    "multiplier" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "copySl" BOOLEAN NOT NULL DEFAULT true,
    "copyTp" BOOLEAN NOT NULL DEFAULT true,
    "reverse" BOOLEAN NOT NULL DEFAULT false,
    "symbolMapping" JSONB,
    "riskLimits" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "SlaveStatus" NOT NULL DEFAULT 'PAUSED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slave_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slave_accounts_masterAccountId_idx" ON "slave_accounts"("masterAccountId");

-- AddForeignKey
ALTER TABLE "master_accounts" ADD CONSTRAINT "master_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slave_accounts" ADD CONSTRAINT "slave_accounts_masterAccountId_fkey" FOREIGN KEY ("masterAccountId") REFERENCES "master_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slave_accounts" ADD CONSTRAINT "slave_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
