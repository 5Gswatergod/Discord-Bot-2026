ALTER TABLE "ReactionRolePanel"
ADD COLUMN "publishedChannelId" TEXT,
ADD COLUMN "publishedReactionSignature" TEXT,
ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "lastSyncError" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "ReactionRolePanel"
SET "publishedChannelId" = "channelId"
WHERE "messageId" IS NOT NULL;

CREATE INDEX "ReactionRolePanel_guildId_deletedAt_enabled_idx"
ON "ReactionRolePanel"("guildId", "deletedAt", "enabled");
