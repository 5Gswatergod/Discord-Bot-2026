import { type Message } from "discord.js";

import { AutoModPunishment, AutoModTrigger, ModerationAction, type AutoModRule } from "@guildforge/database";
import { autoModRuleInputSchema } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { createModerationCase, createWarning, sendModerationActionLog } from "../moderation";
import { isGuildModuleEnabled } from "../modules";

type RulePattern = ReturnType<typeof autoModRuleInputSchema.parse>["pattern"];

const linkPattern = /(https?:\/\/|www\.)\S+/i;
const invitePattern = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-z0-9-]+/i;

function getRulePattern(rule: AutoModRule): RulePattern {
  const parsed = autoModRuleInputSchema.shape.pattern.safeParse(rule.pattern ?? {});

  return parsed.success ? parsed.data : autoModRuleInputSchema.shape.pattern.parse({});
}

function isIgnored(message: Message<true>, rule: AutoModRule) {
  if (rule.ignoredChannelIds.includes(message.channelId)) {
    return true;
  }

  const member = message.member;

  if (!member) {
    return false;
  }

  return member.roles.cache.some((role) => rule.ignoredRoleIds.includes(role.id));
}

async function matchesRule(message: Message<true>, rule: AutoModRule, context: CommandContext) {
  const pattern = getRulePattern(rule);
  const content = message.content.trim();
  const lowerContent = content.toLowerCase();

  switch (rule.trigger) {
    case AutoModTrigger.BANNED_WORD:
      return pattern.words.some((word) => lowerContent.includes(word.toLowerCase()));
    case AutoModTrigger.LINK:
      return linkPattern.test(content) && !invitePattern.test(content);
    case AutoModTrigger.INVITE_LINK:
      return invitePattern.test(content);
    case AutoModTrigger.MASS_MENTION:
      return message.mentions.users.size + message.mentions.roles.size > pattern.maxMentions;
    case AutoModTrigger.CAPS_LOCK: {
      const letters = content.replace(/[^a-zA-Z]/g, "");

      if (letters.length < pattern.capsMinLength) {
        return false;
      }

      const uppercase = letters.replace(/[^A-Z]/g, "").length;

      return uppercase / letters.length >= pattern.capsPercentage;
    }
    case AutoModTrigger.SPAM: {
      if (!context.redis) {
        return false;
      }

      const key = `automod:spam:${message.guild.id}:${message.author.id}`;
      const count = await context.redis.incr(key);

      if (count === 1) {
        await context.redis.expire(key, pattern.windowSeconds);
      }

      return count > pattern.maxMessages;
    }
    case AutoModTrigger.REPEATED_MESSAGE: {
      if (!context.redis || content.length === 0) {
        return false;
      }

      const key = `automod:repeat:${message.guild.id}:${message.author.id}`;
      const previous = await context.redis.hgetall(key);
      const hash = lowerContent.slice(0, 500);
      const count = previous.content === hash ? Number(previous.count ?? 0) + 1 : 1;
      await context.redis.hset(key, {
        content: hash,
        count: String(count)
      });
      await context.redis.expire(key, pattern.windowSeconds);

      return count >= pattern.repeatedLimit;
    }
    default:
      return false;
  }
}

async function applyPunishment(message: Message<true>, rule: AutoModRule, context: CommandContext) {
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  const reason = `自動管理：${rule.name}`;

  if (message.deletable) {
    await message.delete().catch(() => null);
  }

  const moderationCase = await createModerationCase(context.prisma, {
    guildId: message.guild.id,
    action:
      rule.punishment === AutoModPunishment.KICK
        ? ModerationAction.KICK
        : rule.punishment === AutoModPunishment.BAN
          ? ModerationAction.BAN
          : rule.punishment === AutoModPunishment.TIMEOUT
            ? ModerationAction.TIMEOUT
            : rule.punishment === AutoModPunishment.WARN
              ? ModerationAction.WARN
              : ModerationAction.CLEAR,
    targetUserId: message.author.id,
    moderatorUserId: message.client.user.id,
    reason,
    durationSeconds: rule.punishmentDurationSeconds,
    expiresAt: rule.punishmentDurationSeconds
      ? new Date(Date.now() + rule.punishmentDurationSeconds * 1000)
      : null
  });

  if (rule.punishment === AutoModPunishment.WARN) {
    await createWarning(context.prisma, {
      guildId: message.guild.id,
      caseId: moderationCase.id,
      targetUserId: message.author.id,
      moderatorUserId: message.client.user.id,
      reason
    });
  }

  if (member && rule.punishment === AutoModPunishment.TIMEOUT && member.moderatable) {
    await member.timeout((rule.punishmentDurationSeconds ?? 600) * 1000, reason).catch(() => null);
  }

  if (member && rule.punishment === AutoModPunishment.KICK && member.kickable) {
    await member.kick(reason).catch(() => null);
  }

  if (rule.punishment === AutoModPunishment.BAN) {
    await message.guild.members.ban(message.author.id, { reason }).catch(() => null);
  }

  await sendModerationActionLog(context, message.guild, {
    action: `AUTOMOD_${rule.punishment}`,
    caseNumber: moderationCase.caseNumber,
    targetUserId: message.author.id,
    moderatorUserId: message.client.user.id,
    reason
  });
}

export async function handleAutoModMessage(message: Message<true>, context: CommandContext) {
  if (message.author.bot || !message.content) {
    return false;
  }

  const moduleEnabled = await isGuildModuleEnabled(context.prisma, message.guild.id, "AUTO_MODERATION");

  if (!moduleEnabled) {
    return false;
  }

  const rules = await context.prisma.autoModRule.findMany({
    where: {
      guildId: message.guild.id,
      enabled: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  for (const rule of rules) {
    if (isIgnored(message, rule)) {
      continue;
    }

    if (await matchesRule(message, rule, context)) {
      await applyPunishment(message, rule, context);
      return true;
    }
  }

  return false;
}
