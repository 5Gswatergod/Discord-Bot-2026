ALTER TYPE "ModuleKey" ADD VALUE 'AI_ASSISTANT';
ALTER TYPE "ModuleKey" ADD VALUE 'MEMBERSHIPS';
ALTER TYPE "ModuleKey" ADD VALUE 'WEB3';

CREATE TYPE "AiRequestStatus" AS ENUM ('SUCCESS', 'FAILED', 'BLOCKED');
CREATE TYPE "MembershipEntitlementStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

CREATE TABLE "AiAssistantRequest" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "status" "AiRequestStatus" NOT NULL,
    "model" TEXT,
    "inputChars" INTEGER NOT NULL DEFAULT 0,
    "outputChars" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiAssistantRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipEntitlement" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "status" "MembershipEntitlementStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleAppliedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MembershipEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipWebhookEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MembershipWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Web3Wallet" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "challengeExpiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Web3Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Web3Verification" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "collectionKey" TEXT NOT NULL,
    "balance" TEXT NOT NULL DEFAULT '0',
    "eligible" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleAppliedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Web3Verification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiAssistantRequest_guildId_messageId_key" ON "AiAssistantRequest"("guildId", "messageId");
CREATE INDEX "AiAssistantRequest_guildId_createdAt_idx" ON "AiAssistantRequest"("guildId", "createdAt");
CREATE INDEX "AiAssistantRequest_guildId_userId_createdAt_idx" ON "AiAssistantRequest"("guildId", "userId", "createdAt");
CREATE UNIQUE INDEX "MembershipEntitlement_guildId_userId_planKey_key" ON "MembershipEntitlement"("guildId", "userId", "planKey");
CREATE UNIQUE INDEX "MembershipEntitlement_guildId_externalId_key" ON "MembershipEntitlement"("guildId", "externalId");
CREATE INDEX "MembershipEntitlement_guildId_status_expiresAt_idx" ON "MembershipEntitlement"("guildId", "status", "expiresAt");
CREATE UNIQUE INDEX "MembershipWebhookEvent_guildId_eventId_key" ON "MembershipWebhookEvent"("guildId", "eventId");
CREATE INDEX "MembershipWebhookEvent_guildId_receivedAt_idx" ON "MembershipWebhookEvent"("guildId", "receivedAt");
CREATE UNIQUE INDEX "Web3Wallet_guildId_userId_key" ON "Web3Wallet"("guildId", "userId");
CREATE UNIQUE INDEX "Web3Wallet_guildId_address_key" ON "Web3Wallet"("guildId", "address");
CREATE INDEX "Web3Wallet_guildId_verifiedAt_idx" ON "Web3Wallet"("guildId", "verifiedAt");
CREATE UNIQUE INDEX "Web3Verification_walletId_collectionKey_key" ON "Web3Verification"("walletId", "collectionKey");
CREATE INDEX "Web3Verification_guildId_eligible_lastCheckedAt_idx" ON "Web3Verification"("guildId", "eligible", "lastCheckedAt");

ALTER TABLE "AiAssistantRequest" ADD CONSTRAINT "AiAssistantRequest_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipEntitlement" ADD CONSTRAINT "MembershipEntitlement_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipWebhookEvent" ADD CONSTRAINT "MembershipWebhookEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Web3Wallet" ADD CONSTRAINT "Web3Wallet_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Web3Verification" ADD CONSTRAINT "Web3Verification_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Web3Verification" ADD CONSTRAINT "Web3Verification_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Web3Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
