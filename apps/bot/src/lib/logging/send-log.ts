import { EmbedBuilder, type Guild } from "discord.js";

import { LogEvent, Prisma } from "@guildforge/database";

import type { CommandContext } from "../../commands/types";
import { isGuildModuleEnabled } from "../modules";

function cleanMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  ) as Prisma.InputJsonObject;
}

export async function sendGuildLog(
  context: CommandContext,
  guild: Guild,
  event: LogEvent,
  embed: EmbedBuilder,
  metadata?: Record<string, unknown>
) {
  const loggingEnabled = await isGuildModuleEnabled(context.prisma, guild.id, "LOGGING");

  if (!loggingEnabled) {
    return;
  }

  const config = await context.prisma.logConfig.findUnique({
    where: {
      guildId_event: {
        guildId: guild.id,
        event
      }
    }
  });

  if (!config?.enabled || !config.channelId) {
    return;
  }

  const channel = await guild.channels.fetch(config.channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  const jsonMetadata = cleanMetadata(metadata);

  await context.prisma.auditLog.create({
    data: {
      guildId: guild.id,
      action: `LOG_${event}`,
      targetType: metadata?.targetType ? String(metadata.targetType) : undefined,
      targetId: metadata?.targetId ? String(metadata.targetId) : undefined,
      metadata: jsonMetadata
    }
  });

  await channel.send({ embeds: [embed.setTimestamp()] }).catch((error) => {
    context.logger.warn("Failed to send guild log", {
      guildId: guild.id,
      event,
      channelId: config.channelId,
      error
    });
  });
}
