import { EmbedBuilder, type GuildMember, type PartialGuildMember } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";
import { handleWelcomeMemberRemove } from "../lib/welcome/send-welcome";

export async function handleGuildMemberRemove(
  member: GuildMember | PartialGuildMember,
  context: CommandContext
) {
  await handleWelcomeMemberRemove(member, context);

  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle("成員離開")
    .addFields({
      name: "成員",
      value: `<@${member.id}> (${member.user?.tag ?? "未知使用者"})`
    });

  await sendGuildLog(context, member.guild, LogEvent.MEMBER_LEAVE, embed, {
    targetType: "User",
    targetId: member.id
  });
}
