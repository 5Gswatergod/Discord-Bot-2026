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
    .setTitle("Member left")
    .addFields({
      name: "Member",
      value: `<@${member.id}> (${member.user?.tag ?? "Unknown"})`
    });

  await sendGuildLog(context, member.guild, LogEvent.MEMBER_LEAVE, embed, {
    targetType: "User",
    targetId: member.id
  });
}
