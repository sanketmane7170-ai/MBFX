/*
  Warnings:

  - You are about to drop the column `accountType` on the `account_snapshots` table. All the data in the column will be lost.
  - You are about to drop the column `masterAccountId` on the `copy_events` table. All the data in the column will be lost.
  - You are about to drop the column `masterTicket` on the `copy_events` table. All the data in the column will be lost.
  - You are about to drop the column `slaveAccountId` on the `copy_events` table. All the data in the column will be lost.
  - You are about to drop the column `slaveTicket` on the `copy_events` table. All the data in the column will be lost.
  - You are about to drop the `master_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `slave_accounts` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `receiverAccountId` to the `copy_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceAccountId` to the `copy_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceTicket` to the `copy_events` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PROVISIONING', 'CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ReceiverStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- DropForeignKey
ALTER TABLE "master_accounts" DROP CONSTRAINT "master_accounts_createdById_fkey";

-- DropForeignKey
ALTER TABLE "slave_accounts" DROP CONSTRAINT "slave_accounts_createdById_fkey";

-- DropForeignKey
ALTER TABLE "slave_accounts" DROP CONSTRAINT "slave_accounts_masterAccountId_fkey";

-- DropIndex
DROP INDEX "copy_events_masterAccountId_ts_idx";

-- DropIndex
DROP INDEX "copy_events_masterTicket_idx";

-- DropIndex
DROP INDEX "copy_events_slaveAccountId_ts_idx";

-- AlterTable
ALTER TABLE "account_snapshots" DROP COLUMN "accountType";

-- AlterTable
ALTER TABLE "copy_events" DROP COLUMN "masterAccountId",
DROP COLUMN "masterTicket",
DROP COLUMN "slaveAccountId",
DROP COLUMN "slaveTicket",
ADD COLUMN     "copierConfigId" TEXT,
ADD COLUMN     "receiverAccountId" TEXT NOT NULL,
ADD COLUMN     "receiverTicket" TEXT,
ADD COLUMN     "sourceAccountId" TEXT NOT NULL,
ADD COLUMN     "sourceTicket" TEXT NOT NULL;

-- DropTable
DROP TABLE "master_accounts";

-- DropTable
DROP TABLE "slave_accounts";

-- DropEnum
DROP TYPE "AccountType";

-- DropEnum
DROP TYPE "MasterStatus";

-- DropEnum
DROP TYPE "SlaveStatus";

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metaapiAccountId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PROVISIONING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copier_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "copyfactoryStrategyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copier_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "copierConfigId" TEXT NOT NULL,
    "receiverAccountId" TEXT NOT NULL,
    "copyfactorySubscriberId" TEXT NOT NULL,
    "sizingMode" "SizingMode" NOT NULL DEFAULT 'MULTIPLIER',
    "multiplier" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "copySl" BOOLEAN NOT NULL DEFAULT true,
    "copyTp" BOOLEAN NOT NULL DEFAULT true,
    "reverse" BOOLEAN NOT NULL DEFAULT false,
    "symbolMapping" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "ReceiverStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "copier_configs_sourceAccountId_key" ON "copier_configs"("sourceAccountId");

-- CreateIndex
CREATE INDEX "subscriptions_copierConfigId_idx" ON "subscriptions"("copierConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_copierConfigId_receiverAccountId_key" ON "subscriptions"("copierConfigId", "receiverAccountId");

-- CreateIndex
CREATE INDEX "copy_events_sourceAccountId_ts_idx" ON "copy_events"("sourceAccountId", "ts");

-- CreateIndex
CREATE INDEX "copy_events_receiverAccountId_ts_idx" ON "copy_events"("receiverAccountId", "ts");

-- CreateIndex
CREATE INDEX "copy_events_copierConfigId_ts_idx" ON "copy_events"("copierConfigId", "ts");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copier_configs" ADD CONSTRAINT "copier_configs_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copier_configs" ADD CONSTRAINT "copier_configs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_copierConfigId_fkey" FOREIGN KEY ("copierConfigId") REFERENCES "copier_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_receiverAccountId_fkey" FOREIGN KEY ("receiverAccountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
