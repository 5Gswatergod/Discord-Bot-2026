import {
  ChannelType,
  PermissionFlagsBits,
  type VoiceState
} from "discord.js";

import {
  formatTemplate,
  temporaryVoiceSettingsSchema
} from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { getGuildModuleSettings } from "../modules";

async function cleanupTemporaryChannel(state: VoiceState, context: CommandContext) {
  if (!state.channelId) {
    return;
  }

  const record = await context.prisma.temporaryVoiceChannel.findUnique({
    where: {
      channelId: state.channelId
    }
  });

  if (!record || state.channel?.members.size) {
    return;
  }

  await context.prisma.temporaryVoiceChannel.deleteMany({
    where: { id: record.id }
  });

  if (state.channel) {
    try {
      await state.channel.delete("Hydrava temporary voice channel became empty");
    } catch (error) {
      await context.prisma.temporaryVoiceChannel
        .create({
          data: {
            id: record.id,
            guildId: record.guildId,
            channelId: record.channelId,
            ownerUserId: record.ownerUserId,
            createdAt: record.createdAt
          }
        })
        .catch(() => null);
      context.logger.warn("Failed to delete empty temporary voice channel", {
        guildId: state.guild.id,
        channelId: state.channelId,
        error
      });
    }
  }
}

export async function handleTemporaryVoiceState(
  oldState: VoiceState,
  newState: VoiceState,
  context: CommandContext
) {
  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    await cleanupTemporaryChannel(oldState, context);
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
    await channel.delete("Temporary voice database creation failed").catch(() => null);
    throw error;
  }
}
