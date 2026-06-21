import { EmbedBuilder, type VoiceState } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";
import { handleTemporaryVoiceState } from "../lib/temporary-voice/temporary-voice";

export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
  context: CommandContext
) {
  if (oldState.channelId === newState.channelId) {
    return;
  }

  await handleTemporaryVoiceState(oldState, newState, context).catch((error) => {
    context.logger.warn("Failed to process temporary voice state", {
      guildId: newState.guild.id,
      userId: newState.id,
      error
    });
  });

  if (!oldState.channelId && newState.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("加入語音頻道")
      .addFields(
        {
          name: "成員",
          value: `<@${newState.id}>`,
          inline: true
        },
        {
          name: "頻道",
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
      .setTitle("離開語音頻道")
      .addFields(
        {
          name: "成員",
          value: `<@${oldState.id}>`,
          inline: true
        },
        {
          name: "頻道",
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
