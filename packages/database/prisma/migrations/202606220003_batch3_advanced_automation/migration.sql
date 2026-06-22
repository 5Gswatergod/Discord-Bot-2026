ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'AUTOMATIONS';

CREATE TYPE "AutomationTrigger" AS ENUM ('MESSAGE_CREATE', 'REACTION_ADD', 'MEMBER_JOIN', 'MEMBER_ROLE_UPDATE');
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED', 'TEST');

CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" "AutomationTrigger" NOT NULL,
    "triggerConfig" JSONB,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "stopProcessing" BOOLEAN NOT NULL DEFAULT false,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "ruleId" TEXT,
    "trigger" "AutomationTrigger" NOT NULL,
    "status" "AutomationExecutionStatus" NOT NULL,
    "eventKey" TEXT,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "channelId" TEXT,
    "messageId" TEXT,
    "durationMs" INTEGER,
    "error" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationRule_guildId_name_key" ON "AutomationRule"("guildId", "name");
CREATE INDEX "AutomationRule_guildId_enabled_trigger_position_idx" ON "AutomationRule"("guildId", "enabled", "trigger", "position");
CREATE UNIQUE INDEX "AutomationExecution_ruleId_eventKey_key" ON "AutomationExecution"("ruleId", "eventKey");
CREATE INDEX "AutomationExecution_guildId_createdAt_idx" ON "AutomationExecution"("guildId", "createdAt");
CREATE INDEX "AutomationExecution_ruleId_createdAt_idx" ON "AutomationExecution"("ruleId", "createdAt");

ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
