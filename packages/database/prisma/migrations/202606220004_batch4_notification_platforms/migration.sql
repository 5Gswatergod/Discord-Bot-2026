ALTER TYPE "SocialAlertType" ADD VALUE IF NOT EXISTS 'TIKTOK';
ALTER TYPE "SocialAlertType" ADD VALUE IF NOT EXISTS 'X';
ALTER TYPE "SocialAlertType" ADD VALUE IF NOT EXISTS 'BLUESKY';
ALTER TYPE "SocialAlertType" ADD VALUE IF NOT EXISTS 'REDDIT';
ALTER TYPE "SocialAlertType" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE "SocialAlertType" ADD VALUE IF NOT EXISTS 'KICK';
ALTER TYPE "SocialAlertType" ADD VALUE IF NOT EXISTS 'PODCAST';

CREATE TYPE "SocialAlertDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "SocialAlert"
ADD COLUMN "mentionRoleId" TEXT,
ADD COLUMN "mentionEveryone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maxItemsPerCheck" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "maxNotificationsPerHour" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastError" TEXT,
ADD COLUMN "lastErrorAt" TIMESTAMP(3),
ADD COLUMN "lastSuccessAt" TIMESTAMP(3);

DROP INDEX "SocialAlert_guildId_enabled_idx";
CREATE INDEX "SocialAlert_guildId_enabled_nextCheckAt_idx" ON "SocialAlert"("guildId", "enabled", "nextCheckAt");

CREATE TABLE "SocialAlertDelivery" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "externalItemId" TEXT NOT NULL,
    "itemUrl" TEXT,
    "status" "SocialAlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "messageId" TEXT,
    "error" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialAlertDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialAlertDelivery_alertId_externalItemId_key" ON "SocialAlertDelivery"("alertId", "externalItemId");
CREATE INDEX "SocialAlertDelivery_guildId_status_createdAt_idx" ON "SocialAlertDelivery"("guildId", "status", "createdAt");
CREATE INDEX "SocialAlertDelivery_alertId_status_createdAt_idx" ON "SocialAlertDelivery"("alertId", "status", "createdAt");

ALTER TABLE "SocialAlertDelivery" ADD CONSTRAINT "SocialAlertDelivery_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAlertDelivery" ADD CONSTRAINT "SocialAlertDelivery_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "SocialAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
