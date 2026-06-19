import { EmbedBuilder, type GuildMember } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";
import { handleWelcomeMemberAdd } from "../lib/welcome/send-welcome";

export async function handleGuildMemberAdd(member: GuildMember, context: CommandContext) {
  await handleWelcomeMemberAdd(member, context);

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("成員加入")
    .addFields(
      {
        name: "成員",
        value: `<@${member.id}> (${member.user.tag})`,
        inline: true
      },
      {
        name: "帳號建立時間",
        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        inline: true
      }
    );

  await sendGuildLog(context, member.guild, LogEvent.MEMBER_JOIN, embed, {
    targetType: "User",
    targetId: member.id
  });
}
