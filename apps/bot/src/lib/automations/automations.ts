import {
  Prisma,
  type AutomationRule,
  type AutomationTrigger
} from "@guildforge/database";
import {
  automationActionSchema,
  automationConditionsSchema,
  automationTriggerConfigSchema,
  evaluateAutomationConditions,
  formatTemplate,
  type AutomationAction
} from "@guildforge/shared";
import {
  type Guild,
  type GuildMember,
  type Message,
  type MessageReaction,
  type PartialGuildMember,
  type PartialMessageReaction,
  type PartialUser,
  type User
} from "discord.js";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { isGuildModuleEnabled } from "../modules";

type AutomationEvent = {
  guild: Guild;
  trigger: AutomationTrigger;
  eventKey: string;
  actorUserId: string | null;
  targetUserId: string | null;
  channelId: string | null;
  messageId: string | null;
  content: string;
  roleIds: string[];
  member: GuildMember | null;
  message: Message<true> | null;
  emoji: string | null;
  emojiAliases: string[];
  addedRoleIds: string[];
  removedRoleIds: string[];
  occurredAt: Date;
};

const suppressedRoleChanges = new Map<string, number>();

function suppressionKey(guildId: string, userId: string, roleId: string) {
  return `${guildId}:${userId}:${roleId}`;
}

function suppressRoleChange(guildId: string, userId: string, roleId: string) {
  suppressedRoleChanges.set(suppressionKey(guildId, userId, roleId), Date.now() + 15_000);
}

export function filterSuppressedRoleChanges(
  guildId: string,
  userId: string,
  roleIds: string[]
) {
  const now = Date.now();

  return roleIds.filter((roleId) => {
    const key = suppressionKey(guildId, userId, roleId);
    const expiresAt = suppressedRoleChanges.get(key);

    if (!expiresAt) {
      return true;
    }

    if (expiresAt <= now) {
      suppressedRoleChanges.delete(key);
      return true;
    }

    suppressedRoleChanges.delete(key);
    return false;
  });
}

function matchesTrigger(rule: AutomationRule, event: AutomationEvent) {
  const config = automationTriggerConfigSchema.parse(rule.triggerConfig ?? {});

  if (event.trigger === "REACTION_ADD" && config.emoji) {
    return event.emojiAliases.includes(config.emoji);
  }

  if (event.trigger === "MEMBER_ROLE_UPDATE") {
    const added = event.addedRoleIds;
    const removed = event.removedRoleIds;

    if (!config.roleId) {
      return config.roleChange === "ADDED"
        ? added.length > 0
        : config.roleChange === "REMOVED"
          ? removed.length > 0
          : added.length > 0 || removed.length > 0;
    }

    return config.roleChange === "ADDED"
      ? added.includes(config.roleId)
      : config.roleChange === "REMOVED"
        ? removed.includes(config.roleId)
        : added.includes(config.roleId) || removed.includes(config.roleId);
  }

  return true;
}

async function getMember(event: AutomationEvent) {
  if (event.member) {
    return event.member;
  }

  if (!event.targetUserId) {
    return null;
  }

  return event.guild.members.fetch(event.targetUserId).catch(() => null);
}

function templateValues(event: AutomationEvent, rule: AutomationRule) {
  const userId = event.targetUserId ?? event.actorUserId ?? "";

  return {
    user: userId ? `<@${userId}>` : "",
    userId,
    username: event.member?.user.username ?? userId,
    displayName: event.member?.displayName ?? event.member?.user.username ?? userId,
    channel: event.channelId ? `<#${event.channelId}>` : "",
    channelId: event.channelId ?? "",
    messageId: event.messageId ?? "",
    content: event.content,
    emoji: event.emoji ?? "",
    addedRoles: event.addedRoleIds.map((roleId) => `<@&${roleId}>`).join(", "),
    removedRoles: event.removedRoleIds.map((roleId) => `<@&${roleId}>`).join(", "),
    server: event.guild.name,
    rule: rule.name
  };
}

async function executeAction(
  action: AutomationAction,
  rule: AutomationRule,
  event: AutomationEvent
) {
  if (action.type === "SEND_MESSAGE") {
    const channelId = action.channelId ?? event.channelId;

    if (!channelId) {
      throw new Error("No destination channel is available");
    }

    const channel = await event.guild.channels.fetch(channelId).catch(() => null);

    if (!isSendableGuildTextChannel(channel)) {
      throw new Error("The destination channel was deleted or cannot receive messages");
    }

    await channel.send({
      content: formatTemplate(action.content, templateValues(event, rule)),
      allowedMentions: {
        parse: [],
        users: event.targetUserId ? [event.targetUserId] : []
      }
    });
    return;
  }

  if (action.type === "DELETE_MESSAGE") {
    if (!event.message) {
      throw new Error("The trigger does not provide a message to delete");
    }

    await event.message.delete();
    return;
  }

  const member = await getMember(event);

  if (!member) {
    throw new Error("The target member no longer exists in the server");
  }

  if (action.type === "ADD_ROLE") {
    suppressRoleChange(event.guild.id, member.id, action.roleId);
    await member.roles.add(action.roleId, `Hydrava automation: ${rule.name}`);
    return;
  }

  const reason = action.reason || `Hydrava automation: ${rule.name}`;

  if (action.type === "TIMEOUT_MEMBER") {
    await member.timeout(action.durationSeconds * 1_000, reason);
    return;
  }

  if (action.type === "KICK_MEMBER") {
    await member.kick(reason);
    return;
  }

  await event.guild.members.ban(member.id, {
    reason,
    deleteMessageSeconds: action.deleteMessageSeconds
  });
}

async function createExecution(
  context: CommandContext,
  rule: AutomationRule,
  event: AutomationEvent,
  status: "SKIPPED" | "FAILED" | "SUCCESS",
  details?: Prisma.InputJsonValue,
  error?: string,
  durationMs?: number
) {
  return context.prisma.automationExecution.create({
    data: {
      guildId: event.guild.id,
      ruleId: rule.id,
      trigger: event.trigger,
      status,
      eventKey: event.eventKey,
      actorUserId: event.actorUserId,
      targetUserId: event.targetUserId,
      channelId: event.channelId,
      messageId: event.messageId,
      durationMs,
      error,
      details
    }
  });
}

export async function runAutomations(context: CommandContext, event: AutomationEvent) {
  if (!(await isGuildModuleEnabled(context.prisma, event.guild.id, "AUTOMATIONS"))) {
    return;
  }

  const rules = await context.prisma.automationRule.findMany({
    where: {
      guildId: event.guild.id,
      trigger: event.trigger,
      enabled: true
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });

  for (const rule of rules) {
    const startedAt = Date.now();

    try {
      if (!matchesTrigger(rule, event)) {
        continue;
      }

      const conditions = automationConditionsSchema.parse(rule.conditions);
      const result = evaluateAutomationConditions(conditions, {
        content: event.content,
        channelId: event.channelId,
        roleIds: event.roleIds,
        occurredAt: event.occurredAt
      });

      if (!result.matched) {
        continue;
      }

      const subjectUserId = event.targetUserId ?? event.actorUserId;

      if (rule.cooldownSeconds > 0 && subjectUserId) {
        const latest = await context.prisma.automationExecution.findFirst({
          where: {
            ruleId: rule.id,
            status: "SUCCESS",
            OR: [{ targetUserId: subjectUserId }, { actorUserId: subjectUserId }],
            createdAt: {
              gte: new Date(Date.now() - rule.cooldownSeconds * 1_000)
            }
          },
          select: { id: true }
        });

        if (latest) {
          await createExecution(context, rule, event, "SKIPPED", {
            reason: "cooldown"
          });
          continue;
        }
      }

      const actions = automationActionSchema.array().parse(rule.actions);
      const execution = await createExecution(context, rule, event, "SKIPPED", {
        state: "processing"
      });

      try {
        for (const action of actions) {
          await executeAction(action, rule, event);
        }

        await context.prisma.automationExecution.update({
          where: { id: execution.id },
          data: {
            status: "SUCCESS",
            durationMs: Date.now() - startedAt,
            details: {
              actions: actions.map((action) => action.type)
            }
          }
        });

        if (rule.stopProcessing) {
          break;
        }
      } catch (error) {
        await context.prisma.automationExecution.update({
          where: { id: execution.id },
          data: {
            status: "FAILED",
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown error"
          }
        });
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      context.logger.warn("Failed to process automation rule", {
        guildId: event.guild.id,
        ruleId: rule.id,
        error
      });
    }
  }
}

export async function handleAutomationMessage(
  message: Message<true>,
  context: CommandContext
) {
  const member =
    message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));

  await runAutomations(context, {
    guild: message.guild,
    trigger: "MESSAGE_CREATE",
    eventKey: `message:${message.id}`,
    actorUserId: message.author.id,
    targetUserId: message.author.id,
    channelId: message.channelId,
    messageId: message.id,
    content: message.content,
    roleIds: member?.roles.cache.map((role) => role.id) ?? [],
    member,
    message,
    emoji: null,
    emojiAliases: [],
    addedRoleIds: [],
    removedRoleIds: [],
    occurredAt: message.createdAt
  });
}

export async function handleAutomationReaction(
  rawReaction: MessageReaction | PartialMessageReaction,
  rawUser: User | PartialUser,
  context: CommandContext
) {
  const user = rawUser.partial ? await rawUser.fetch().catch(() => null) : rawUser;

  if (!user || user.bot) {
    return;
  }

  const reaction = rawReaction.partial
    ? await rawReaction.fetch().catch(() => null)
    : rawReaction;

  if (!reaction) {
    return;
  }

  const message = reaction.message.partial
    ? await reaction.message.fetch().catch(() => null)
    : reaction.message;

  if (!message?.inGuild()) {
    return;
  }

  const member = await message.guild.members.fetch(user.id).catch(() => null);
  const emojiAliases = [
    reaction.emoji.id,
    reaction.emoji.name,
    reaction.emoji.toString()
  ].filter((value): value is string => Boolean(value));
  const emoji = reaction.emoji.toString();

  await runAutomations(context, {
    guild: message.guild,
    trigger: "REACTION_ADD",
    eventKey: `reaction:${message.id}:${emoji}:${user.id}:${Math.floor(Date.now() / 5_000)}`,
    actorUserId: user.id,
    targetUserId: user.id,
    channelId: message.channelId,
    messageId: message.id,
    content: message.content,
    roleIds: member?.roles.cache.map((role) => role.id) ?? [],
    member,
    message,
    emoji,
    emojiAliases,
    addedRoleIds: [],
    removedRoleIds: [],
    occurredAt: new Date()
  });
}

export async function handleAutomationMemberJoin(
  member: GuildMember,
  context: CommandContext
) {
  await runAutomations(context, {
    guild: member.guild,
    trigger: "MEMBER_JOIN",
    eventKey: `member-join:${member.id}:${member.joinedTimestamp ?? Date.now()}`,
    actorUserId: member.id,
    targetUserId: member.id,
    channelId: null,
    messageId: null,
    content: "",
    roleIds: member.roles.cache.map((role) => role.id),
    member,
    message: null,
    emoji: null,
    emojiAliases: [],
    addedRoleIds: [],
    removedRoleIds: [],
    occurredAt: new Date(member.joinedTimestamp ?? Date.now())
  });
}

export async function handleAutomationRoleUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
  context: CommandContext
) {
  const addedRoleIds = filterSuppressedRoleChanges(
    newMember.guild.id,
    newMember.id,
    newMember.roles.cache
      .filter((role) => !oldMember.roles.cache.has(role.id))
      .map((role) => role.id)
  );
  const removedRoleIds = filterSuppressedRoleChanges(
    newMember.guild.id,
    newMember.id,
    oldMember.roles.cache
      .filter((role) => !newMember.roles.cache.has(role.id))
      .map((role) => role.id)
  );

  if (addedRoleIds.length === 0 && removedRoleIds.length === 0) {
    return;
  }

  await runAutomations(context, {
    guild: newMember.guild,
    trigger: "MEMBER_ROLE_UPDATE",
    eventKey: `role:${newMember.id}:${addedRoleIds.sort().join(",")}:${removedRoleIds.sort().join(",")}:${Math.floor(Date.now() / 5_000)}`,
    actorUserId: newMember.id,
    targetUserId: newMember.id,
    channelId: null,
    messageId: null,
    content: "",
    roleIds: newMember.roles.cache.map((role) => role.id),
    member: newMember,
    message: null,
    emoji: null,
    emojiAliases: [],
    addedRoleIds,
    removedRoleIds,
    occurredAt: new Date()
  });
}
