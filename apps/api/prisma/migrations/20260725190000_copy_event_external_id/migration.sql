-- Idempotency key for CopyFactory transactions -> copy_events (e.g. "2048676112:open")
ALTER TABLE "copy_events" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "copy_events_externalId_key" ON "copy_events"("externalId");
