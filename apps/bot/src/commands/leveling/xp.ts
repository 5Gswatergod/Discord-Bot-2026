import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { requireGuildPermission } from "../../lib/permissions";
import { leaderboardCommand, rankCommand } from "./rank";

export const xpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setNameLocalizations({ "zh-TW": "經驗值" })
    .setDescription("管理經驗值紀錄。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reset")
        .setNameLocalizations({ "zh-TW": "重設" })
        .setDescription("重設單一成員或整個伺服器的經驗值。")
        .addUserOption((option) =>
          option
            .setName("user")
            .setNameLocalizations({ "zh-TW": "使用者" })
            .setDescription("要重設的成員，留空則重設所有成員。")
        )
    ),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "此指令只能在伺服器內使用。",
        ephemeral: true
      });
      return;
    }

    if (
      !(await requireGuildPermission(
        interaction,
        PermissionFlagsBits.ManageGuild,
        "管理伺服器"
      ))
    ) {
      return;
    }

    const user = interaction.options.getUser("user");

    if (user) {
      await context.prisma.levelingUser.deleteMany({
        where: {
          guildId: interaction.guildId,
          userId: user.id
        }
      });

      await interaction.reply({
        content: `已重設 ${user.tag} 的經驗值。`,
        ephemeral: true
      });
      return;
    }

    const result = await context.prisma.levelingUser.deleteMany({
      where: {
        guildId: interaction.guildId
      }
    });

    await interaction.reply({
      content: `已重設 ${result.count} 位成員的經驗值。`,
      ephemeral: true
    });
  }
};

export const levelingCommands = [rankCommand, leaderboardCommand, xpCommand] satisfies BotCommand[];
