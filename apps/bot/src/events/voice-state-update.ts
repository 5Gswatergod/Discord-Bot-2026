import { EmbedBuilder, type VoiceState } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";

export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
  context: CommandContext
) {
  if (oldState.channelId === newState.channelId) {
    return;
  }

  if (!oldState.channelId && newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("Voice joined")
      .addFields(
        {
          name: "Member",
          value: `<@${newState.id}>`,
          inline: true
        },
        {
          name: "Channel",
          value: `<#${newState.channelId}>`,
          inline: true
        }
      );

    await sendGuildLog(context, newState.guild, LogEvent.VOICE_JOIN, embed, {
      targetType: "User",
      targetId: newState.id,
      channelId: newState.channelId
    });
  }

  if (oldState.channelId && !newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0xf97316)
      .setTitle("Voice left")
      .addFields(
        {
          name: "Member",
          value: `<@${oldState.id}>`,
          inline: true
        },
        {
          name: "Channel",
          value: `<#${oldState.channelId}>`,
          inline: true
        }
      );

    await sendGuildLog(context, oldState.guild, LogEvent.VOICE_LEAVE, embed, {
      targetType: "User",
      targetId: oldState.id,
      channelId: oldState.channelId
    });
  }
}
