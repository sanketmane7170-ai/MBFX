-- Trade filters + trading-hours window on subscriptions
CREATE TYPE "SymbolFilterMode" AS ENUM ('NONE', 'INCLUDE', 'EXCLUDE');

ALTER TABLE "subscriptions"
  ADD COLUMN "symbolFilterMode" "SymbolFilterMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "symbolFilterList" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "minVolume" DOUBLE PRECISION,
  ADD COLUMN "maxVolume" DOUBLE PRECISION,
  ADD COLUMN "tradeWindowStart" INTEGER,
  ADD COLUMN "tradeWindowEnd" INTEGER;

-- Broker margin mode captured from MetaApi
ALTER TABLE "accounts" ADD COLUMN "marginMode" TEXT;

-- In-app notifications
CREATE TYPE "NotificationType" AS ENUM ('COPY_FAILED', 'ACCOUNT_OFFLINE', 'ACCOUNT_ONLINE', 'INFO');

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "meta" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
