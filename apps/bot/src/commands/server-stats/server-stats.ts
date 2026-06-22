import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { requireGuildPermission } from "../../lib/permissions";
import { syncGuildServerStats } from "../../lib/server-stats/server-stats";

export const serverStatsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("server-stats")
    .setNameLocalizations({ "zh-TW": "統計頻道" })
    .setDescription("立即更新伺服器統計頻道。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "此指令只能在伺服器內使用。", ephemeral: true });
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

    await interaction.deferReply({ ephemeral: true });
    await syncGuildServerStats(context, interaction.guildId);
    await interaction.editReply("統計頻道已更新。");
  }
};

export const serverStatsCommands = [serverStatsCommand] satisfies BotCommand[];
