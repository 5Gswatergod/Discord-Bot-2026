import { ChannelType, PermissionFlagsBits, type Guild } from "discord.js";

import { ModuleKey, type ServerStatType } from "@guildforge/database";
import { formatTemplate } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";

const textChannelTypes = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildMedia
]);
const voiceChannelTypes = new Set([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);

async function buildCounts(guild: Guild, types: Set<ServerStatType>) {
  const counts = new Map<ServerStatType, number>();

  counts.set("MEMBER_COUNT", guild.memberCount);
  counts.set("ROLE_COUNT", Math.max(0, guild.roles.cache.size - 1));
  counts.set(
    "TEXT_CHANNEL_COUNT",
    guild.channels.cache.filter((channel) => textChannelTypes.has(channel.type)).size
  );
  counts.set(
    "VOICE_CHANNEL_COUNT",
    guild.channels.cache.filter((channel) => voiceChannelTypes.has(channel.type)).size
  );

  if (types.has("HUMAN_COUNT") || types.has("BOT_COUNT")) {
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    counts.set("BOT_COUNT", members.filter((member) => member.user.bot).size);
    counts.set("HUMAN_COUNT", members.filter((member) => !member.user.bot).size);
  }

  return counts;
}

export async function syncGuildServerStats(
  context: CommandContext,
  guildId: string
) {
  const moduleConfig = await context.prisma.moduleConfig.findUnique({
    where: {
      guildId_module: {
        guildId,
        module: ModuleKey.SERVER_STATS
      }
    },
    select: {
      enabled: true
    }
  });

  if (!moduleConfig?.enabled) {
    return;
  }

  const records = await context.prisma.serverStatChannel.findMany({
    where: {
      guildId,
      enabled: true
    }
  });
  const guild = context.client.guilds.cache.get(guildId);

  if (!guild || records.length === 0) {
    return;
  }

  const counts = await buildCounts(guild, new Set(records.map((record) => record.type)));

  for (const record of records) {
    try {
      const count = counts.get(record.type) ?? 0;
      const name = formatTemplate(record.template, { count }).slice(0, 100);
      let channel = record.channelId
        ? await guild.channels.fetch(record.channelId).catch(() => null)
        : null;

      if (!channel || channel.type !== ChannelType.GuildVoice) {
        const categoryId =
          record.categoryId &&
          guild.channels.cache.get(record.categoryId)?.type === ChannelType.GuildCategory
            ? record.categoryId
            : undefined;
        channel = await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          parent: categoryId,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.Connect]
            }
          ],
          reason: `Hydrava server statistic: ${record.type}`
        });
        await context.prisma.serverStatChannel.update({
          where: { id: record.id },
          data: { channelId: channel.id }
        });
      } else if (channel.name !== name) {
        await channel.setName(name, `Hydrava server statistic: ${record.type}`);
      }
    } catch (error) {
      context.logger.warn("Failed to synchronize server statistic channel", {
        guildId,
        serverStatChannelId: record.id,
        error
      });
    }
  }
}

export async function syncServerStats(context: CommandContext) {
  const configs = await context.prisma.moduleConfig.findMany({
    where: {
      module: ModuleKey.SERVER_STATS,
      enabled: true
    },
    select: {
      guildId: true
    }
  });

  for (const config of configs) {
    await syncGuildServerStats(context, config.guildId);
  }
}
