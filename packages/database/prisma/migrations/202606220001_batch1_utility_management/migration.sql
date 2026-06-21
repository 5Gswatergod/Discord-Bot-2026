ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'TICKETS';
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'INVITE_TRACKING';
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'EMBED_MESSAGES';
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'REMINDERS';

CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "claimedByUserId" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "closeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InviteAttribution" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "inviterUserId" TEXT,
    "inviteCode" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InviteAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmbedMessage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "content" TEXT,
    "title" TEXT,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#24b47e',
    "url" TEXT,
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "footerText" TEXT,
    "authorName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmbedMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "intervalSeconds" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");
CREATE INDEX "Ticket_guildId_status_idx" ON "Ticket"("guildId", "status");
CREATE INDEX "Ticket_guildId_ownerUserId_status_idx" ON "Ticket"("guildId", "ownerUserId", "status");
CREATE UNIQUE INDEX "InviteAttribution_guildId_memberUserId_key" ON "InviteAttribution"("guildId", "memberUserId");
CREATE INDEX "InviteAttribution_guildId_inviterUserId_idx" ON "InviteAttribution"("guildId", "inviterUserId");
CREATE INDEX "InviteAttribution_guildId_joinedAt_idx" ON "InviteAttribution"("guildId", "joinedAt");
CREATE INDEX "EmbedMessage_guildId_enabled_idx" ON "EmbedMessage"("guildId", "enabled");
CREATE INDEX "EmbedMessage_guildId_channelId_idx" ON "EmbedMessage"("guildId", "channelId");
CREATE INDEX "Reminder_guildId_enabled_nextRunAt_idx" ON "Reminder"("guildId", "enabled", "nextRunAt");

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InviteAttribution" ADD CONSTRAINT "InviteAttribution_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmbedMessage" ADD CONSTRAINT "EmbedMessage_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
