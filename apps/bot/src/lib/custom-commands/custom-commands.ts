import { EmbedBuilder, type Message } from "discord.js";

import { formatTemplate } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { isGuildModuleEnabled } from "../modules";

function hasAllowedRole(message: Message<true>, allowedRoleIds: string[]) {
  if (allowedRoleIds.length === 0) {
    return true;
  }

  return message.member?.roles.cache.some((role) => allowedRoleIds.includes(role.id)) ?? false;
}

function renderResponse(template: string, message: Message<true>) {
  return formatTemplate(template, {
    user: `<@${message.author.id}>`,
    username: message.author.username,
    server: message.guild.name,
    channel: `<#${message.channelId}>`,
    memberCount: message.guild.memberCount
  });
}

export async function handleCustomCommandMessage(message: Message<true>, context: CommandContext) {
  if (message.author.bot || !message.content) {
    return false;
  }

  const enabled = await isGuildModuleEnabled(context.prisma, message.guild.id, "CUSTOM_COMMANDS");

  if (!enabled) {
    return false;
  }

  const guildConfig = await context.prisma.guildConfig.findUnique({
    where: {
      guildId: message.guild.id
    }
  });
  const prefix = guildConfig?.commandPrefix ?? "!";

  if (!message.content.startsWith(prefix)) {
    return false;
  }

  const [rawName] = message.content.slice(prefix.length).trim().split(/\s+/);
  const name = rawName?.toLowerCase();

  if (!name) {
    return false;
  }

  const command = await context.prisma.customCommand.findUnique({
    where: {
      guildId_name: {
        guildId: message.guild.id,
        name
      }
    }
  });

  if (!command?.enabled || command.type !== "PREFIX") {
    return false;
  }

  if (
    command.allowedChannelIds.length > 0 &&
    !command.allowedChannelIds.includes(message.channelId)
  ) {
    return true;
  }

  if (!hasAllowedRole(message, command.allowedRoleIds)) {
    return true;
  }

  if (context.redis && command.cooldownSeconds > 0) {
    const key = `custom-command:cooldown:${message.guild.id}:${command.id}:${message.author.id}`;
    const activeCooldown = await context.redis.get(key);

    if (activeCooldown) {
      return true;
    }

    await context.redis.set(key, "1", "EX", command.cooldownSeconds);
  }

  const content = command.responseText ? renderResponse(command.responseText, message) : undefined;
  const embeds = command.responseEmbed
    ? [new EmbedBuilder(command.responseEmbed as Record<string, unknown>)]
    : undefined;

  await message.reply({
    content,
    embeds
  });

  await context.prisma.auditLog.create({
    data: {
      guildId: message.guild.id,
      actorUserId: message.author.id,
      action: "CUSTOM_COMMAND_RUN",
      targetType: "CustomCommand",
      targetId: command.id,
      metadata: {
        name: command.name
      }
    }
  });

  return true;
}
