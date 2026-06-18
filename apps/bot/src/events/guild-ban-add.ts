import { EmbedBuilder, type GuildBan } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";

export async function handleGuildBanAdd(ban: GuildBan, context: CommandContext) {
  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("Member banned")
    .addFields({
      name: "User",
      value: `<@${ban.user.id}> (${ban.user.tag})`
    });

  await sendGuildLog(context, ban.guild, LogEvent.MEMBER_BAN, embed, {
    targetType: "User",
    targetId: ban.user.id
  });
}
