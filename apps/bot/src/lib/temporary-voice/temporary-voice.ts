import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type VoiceState
} from "discord.js";

import type { TemporaryVoiceChannel } from "@guildforge/database";
import {
  formatTemplate,
  temporaryVoiceSettingsSchema
} from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { getGuildModuleSettings } from "../modules";

async function cleanupTemporaryChannel(
  guild: Guild,
  channelId: string,
  context: CommandContext
) {
  const record = await context.prisma.temporaryVoiceChannel.findUnique({
    where: {
      channelId
    }
  });

  if (!record) {
    return;
  }

  await cleanupTemporaryVoiceRecord(guild, record, context);
}

async function cleanupTemporaryVoiceRecord(
  guild: Guild,
  record: TemporaryVoiceChannel,
  context: CommandContext
) {
  const channel = await guild.channels.fetch(record.channelId).catch(() => null);

  if (!channel) {
    await context.prisma.temporaryVoiceChannel.deleteMany({
      where: { id: record.id }
    });
    return "missing" as const;
  }

  if (channel.type !== ChannelType.GuildVoice) {
    await context.prisma.temporaryVoiceChannel.deleteMany({
      where: { id: record.id }
    });
    return "invalid" as const;
  }

  if (channel.members.size > 0) {
    return "active" as const;
  }

  try {
    await channel.delete("Hydrava temporary voice channel became empty");
    await context.prisma.temporaryVoiceChannel.deleteMany({
      where: { id: record.id }
    });
    return "deleted" as const;
  } catch (error) {
    context.logger.warn("Failed to delete empty temporary voice channel; will retry", {
      guildId: guild.id,
      channelId: record.channelId,
      error
    });
    return "failed" as const;
  }
}

export async function reconcileTemporaryVoiceChannels(context: CommandContext) {
  const records = await context.prisma.temporaryVoiceChannel.findMany({
    orderBy: {
      createdAt: "asc"
    }
  });
  const summary = {
    checked: records.length,
    deleted: 0,
    missing: 0,
    invalid: 0,
    active: 0,
    failed: 0,
    unavailableGuilds: 0
  };

  for (const record of records) {
    const guild = context.client.guilds.cache.get(record.guildId);

    if (!guild) {
      summary.unavailableGuilds += 1;
      continue;
    }

    const result = await cleanupTemporaryVoiceRecord(guild, record, context);
    summary[result] += 1;
  }

  if (summary.deleted || summary.missing || summary.invalid || summary.failed) {
    context.logger.info("Reconciled temporary voice channels", summary);
  }

  return summary;
}

export async function forgetTemporaryVoiceChannel(channelId: string, context: CommandContext) {
  await context.prisma.temporaryVoiceChannel.deleteMany({
    where: { channelId }
  });
}

export async function handleTemporaryVoiceState(
  oldState: VoiceState,
  newState: VoiceState,
  context: CommandContext
) {
  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    await cleanupTemporaryChannel(oldState.guild, oldState.channelId, context);
  }

  if (!newState.channelId || oldState.channelId === newState.channelId || !newState.member) {
    return;
  }

  const config = await getGuildModuleSettings(
    context.prisma,
    newState.guild.id,
    "TEMPORARY_VOICE"
  );

  if (!config.enabled) {
    return;
  }

  const settings = temporaryVoiceSettingsSchema.parse(config.settings ?? {});

  if (!settings.lobbyChannelId || newState.channelId !== settings.lobbyChannelId) {
    return;
  }

  const existing = await context.prisma.temporaryVoiceChannel.findFirst({
    where: {
      guildId: newState.guild.id,
      ownerUserId: newState.id
    }
  });

  if (existing) {
    const existingChannel = await newState.guild.channels.fetch(existing.channelId).catch(() => null);

    if (existingChannel?.type === ChannelType.GuildVoice) {
      await newState.setChannel(existingChannel, "Return to owned Hydrava voice channel");
      return;
    }

    await context.prisma.temporaryVoiceChannel.delete({
      where: { id: existing.id }
    });
  }

  const categoryId =
    settings.categoryId &&
    newState.guild.channels.cache.get(settings.categoryId)?.type === ChannelType.GuildCategory
      ? settings.categoryId
      : undefined;
  const channel = await newState.guild.channels.create({
    name: formatTemplate(settings.nameTemplate, {
      username: newState.member.user.username,
      displayName: newState.member.displayName
    }).slice(0, 100),
    type: ChannelType.GuildVoice,
    parent: categoryId,
    userLimit: settings.userLimit,
    bitrate: Math.min(settings.bitrate, newState.guild.maximumBitrate),
    permissionOverwrites: [
      {
        id: newState.id,
        allow: [
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MoveMembers,
          PermissionFlagsBits.MuteMembers
        ]
      }
    ],
    reason: `Hydrava temporary voice channel for ${newState.member.user.tag}`
  });

  try {
    await context.prisma.temporaryVoiceChannel.create({
      data: {
        guildId: newState.guild.id,
        channelId: channel.id,
        ownerUserId: newState.id
      }
    });
    await newState.setChannel(channel, "Hydrava temporary voice channel created");
  } catch (error) {
    const channelDeleted = await channel
      .delete("Temporary voice creation failed")
      .then(() => true)
      .catch(() => false);

    if (channelDeleted) {
      await context.prisma.temporaryVoiceChannel.deleteMany({
        where: { channelId: channel.id }
      });
    }

    throw error;
  }
}
