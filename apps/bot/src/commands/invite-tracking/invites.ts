import { SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { isGuildModuleEnabled } from "../../lib/modules";

export const invitesCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("invites")
    .setNameLocalizations({ "zh-TW": "邀請數" })
    .setDescription("查看成員成功邀請的人數。")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "成員" })
        .setDescription("要查詢的成員。")
    ),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "此指令只能在伺服器內使用。", ephemeral: true });
      return;
    }

    if (!(await isGuildModuleEnabled(context.prisma, interaction.guildId, "INVITE_TRACKING"))) {
      await interaction.reply({ content: "此伺服器已停用邀請追蹤。", ephemeral: true });
      return;
    }

    const user = interaction.options.getUser("user") ?? interaction.user;
    const count = await context.prisma.inviteAttribution.count({
      where: {
        guildId: interaction.guildId,
        inviterUserId: user.id
      }
    });

    await interaction.reply(`${user} 目前成功邀請了 **${count}** 位成員。`);
  }
};

export const inviteLeaderboardCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("invite-leaderboard")
    .setNameLocalizations({ "zh-TW": "邀請排行榜" })
    .setDescription("查看伺服器邀請排行榜。")
    .setDMPermission(false),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "此指令只能在伺服器內使用。", ephemeral: true });
      return;
    }

    if (!(await isGuildModuleEnabled(context.prisma, interaction.guildId, "INVITE_TRACKING"))) {
      await interaction.reply({ content: "此伺服器已停用邀請追蹤。", ephemeral: true });
      return;
    }

    const rows = await context.prisma.inviteAttribution.findMany({
      where: {
        guildId: interaction.guildId,
        inviterUserId: { not: null }
      },
      select: {
        inviterUserId: true
      },
      take: 5_000
    });
    const counts = new Map<string, number>();

    for (const row of rows) {
      if (row.inviterUserId) {
        counts.set(row.inviterUserId, (counts.get(row.inviterUserId) ?? 0) + 1);
      }
    }

    const leaderboard = [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10);

    await interaction.reply(
      leaderboard.length > 0
        ? leaderboard
            .map(([userId, count], index) => `**${index + 1}.** <@${userId}> — ${count} 人`)
            .join("\n")
        : "目前還沒有邀請紀錄。"
    );
  }
};

export const inviteTrackingCommands = [
  invitesCommand,
  inviteLeaderboardCommand
] satisfies BotCommand[];
