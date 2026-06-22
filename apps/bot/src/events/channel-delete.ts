import { EmbedBuilder, type GuildBasedChannel } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";
import { forgetTemporaryVoiceChannel } from "../lib/temporary-voice/temporary-voice";

export async function handleChannelDelete(channel: GuildBasedChannel, context: CommandContext) {
  await forgetTemporaryVoiceChannel(channel.id, context);

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("頻道已刪除")
    .addFields({
      name: "頻道",
      value: `${channel.name} (${channel.id})`
    });

  await sendGuildLog(context, channel.guild, LogEvent.CHANNEL_DELETE, embed, {
    targetType: "Channel",
    targetId: channel.id
  });
}
