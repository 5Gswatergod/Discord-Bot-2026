import { EmbedBuilder, type GuildMember } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";
import { handleWelcomeMemberAdd } from "../lib/welcome/send-welcome";
import { trackMemberInvite } from "../lib/invite-tracking/invite-tracking";
import { checkUserAchievements } from "../lib/achievements/achievements";
import { handleAutomationMemberJoin } from "../lib/automations/automations";

export async function handleGuildMemberAdd(member: GuildMember, context: CommandContext) {
  await handleWelcomeMemberAdd(member, context);
  const inviterUserId = await trackMemberInvite(member, context).catch((error) => {
    context.logger.warn("Failed to attribute member invite", {
      guildId: member.guild.id,
      userId: member.id,
      error
    });
    return null;
  });

  if (inviterUserId) {
    await checkUserAchievements(context, member.guild.id, inviterUserId).catch((error) => {
      context.logger.warn("Failed to check inviter achievements", {
        guildId: member.guild.id,
        userId: inviterUserId,
        error
      });
    });
  }

  await handleAutomationMemberJoin(member, context).catch((error) => {
    context.logger.warn("Failed to process member join automation", {
      guildId: member.guild.id,
      userId: member.id,
      error
    });
  });

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
