-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "alertEmail" TEXT,
ADD COLUMN     "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smtpFromEmail" TEXT,
ADD COLUMN     "smtpFromName" TEXT,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPasswordEncrypted" TEXT,
ADD COLUMN     "smtpPort" INTEGER,
ADD COLUMN     "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smtpUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "smtpUser" TEXT;
