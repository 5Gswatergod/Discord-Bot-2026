import { EmbedBuilder, type GuildBasedChannel } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";

export async function handleChannelCreate(channel: GuildBasedChannel, context: CommandContext) {
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("頻道已建立")
    .addFields({
      name: "頻道",
      value: `${channel.name} (${channel.id})`
    });

  await sendGuildLog(context, channel.guild, LogEvent.CHANNEL_CREATE, embed, {
    targetType: "Channel",
    targetId: channel.id
  });
}
