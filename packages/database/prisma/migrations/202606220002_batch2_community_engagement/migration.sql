ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'STARBOARD';
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'ACHIEVEMENTS';
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'BIRTHDAYS';
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'SERVER_STATS';
ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'TEMPORARY_VOICE';

CREATE TYPE "AchievementTrigger" AS ENUM ('MESSAGE_COUNT', 'LEVEL', 'INVITE_COUNT');
CREATE TYPE "ServerStatType" AS ENUM ('MEMBER_COUNT', 'HUMAN_COUNT', 'BOT_COUNT', 'ROLE_COUNT', 'TEXT_CHANNEL_COUNT', 'VOICE_CHANNEL_COUNT');

CREATE TABLE "StarboardEntry" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "sourceChannelId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "starboardChannelId" TEXT NOT NULL,
    "starboardMessageId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "starCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StarboardEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "trigger" "AchievementTrigger" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "rewardRoleId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AchievementAward" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AchievementAward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemberActivity" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemberActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Birthday" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "year" INTEGER,
    "lastCelebratedYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Birthday_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServerStatChannel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" "ServerStatType" NOT NULL,
    "template" TEXT NOT NULL,
    "categoryId" TEXT,
    "channelId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServerStatChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemporaryVoiceChannel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemporaryVoiceChannel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StarboardEntry_guildId_sourceMessageId_key" ON "StarboardEntry"("guildId", "sourceMessageId");
CREATE INDEX "StarboardEntry_guildId_starboardChannelId_idx" ON "StarboardEntry"("guildId", "starboardChannelId");
CREATE UNIQUE INDEX "Achievement_guildId_name_key" ON "Achievement"("guildId", "name");
CREATE INDEX "Achievement_guildId_enabled_trigger_idx" ON "Achievement"("guildId", "enabled", "trigger");
CREATE UNIQUE INDEX "AchievementAward_achievementId_userId_key" ON "AchievementAward"("achievementId", "userId");
CREATE INDEX "AchievementAward_guildId_userId_awardedAt_idx" ON "AchievementAward"("guildId", "userId", "awardedAt");
CREATE UNIQUE INDEX "MemberActivity_guildId_userId_key" ON "MemberActivity"("guildId", "userId");
CREATE INDEX "MemberActivity_guildId_messageCount_idx" ON "MemberActivity"("guildId", "messageCount");
CREATE UNIQUE INDEX "Birthday_guildId_userId_key" ON "Birthday"("guildId", "userId");
CREATE INDEX "Birthday_guildId_month_day_idx" ON "Birthday"("guildId", "month", "day");
CREATE UNIQUE INDEX "ServerStatChannel_guildId_type_key" ON "ServerStatChannel"("guildId", "type");
CREATE INDEX "ServerStatChannel_guildId_enabled_idx" ON "ServerStatChannel"("guildId", "enabled");
CREATE UNIQUE INDEX "TemporaryVoiceChannel_channelId_key" ON "TemporaryVoiceChannel"("channelId");
CREATE UNIQUE INDEX "TemporaryVoiceChannel_guildId_ownerUserId_key" ON "TemporaryVoiceChannel"("guildId", "ownerUserId");

ALTER TABLE "StarboardEntry" ADD CONSTRAINT "StarboardEntry_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AchievementAward" ADD CONSTRAINT "AchievementAward_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AchievementAward" ADD CONSTRAINT "AchievementAward_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberActivity" ADD CONSTRAINT "MemberActivity_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Birthday" ADD CONSTRAINT "Birthday_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServerStatChannel" ADD CONSTRAINT "ServerStatChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemporaryVoiceChannel" ADD CONSTRAINT "TemporaryVoiceChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
