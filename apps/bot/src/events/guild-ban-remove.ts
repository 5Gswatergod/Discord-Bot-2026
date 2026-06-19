import { EmbedBuilder, type GuildBan } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";

export async function handleGuildBanRemove(ban: GuildBan, context: CommandContext) {
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("成員已解除封鎖")
    .addFields({
      name: "使用者",
      value: `<@${ban.user.id}> (${ban.user.tag})`
    });

  await sendGuildLog(context, ban.guild, LogEvent.MEMBER_UNBAN, embed, {
    targetType: "User",
    targetId: ban.user.id
  });
}
