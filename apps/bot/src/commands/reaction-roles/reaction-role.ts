import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { publishReactionRolePanel } from "../../lib/reaction-roles/reaction-roles";
import { isGuildModuleEnabled } from "../../lib/modules";
import { requireGuildPermission } from "../../lib/permissions";

export const reactionRoleCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("reaction-role")
    .setNameLocalizations({ "zh-TW": "自助身分組" })
    .setDescription("管理自助身分組面板。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("publish")
        .setNameLocalizations({ "zh-TW": "發布" })
        .setDescription("發佈已設定的自助身分組面板。")
        .addStringOption((option) =>
          option
            .setName("panel_id")
            .setNameLocalizations({ "zh-TW": "面板_id" })
            .setDescription("管理面板中的面板 ID。")
            .setRequired(true)
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

    const enabled = await isGuildModuleEnabled(context.prisma, interaction.guildId, "REACTION_ROLES");

    if (!enabled) {
      await interaction.reply({
        content: "此伺服器已停用自助身分組功能。",
        ephemeral: true
      });
      return;
    }

    const panelId = interaction.options.getString("panel_id", true);
    const message = await publishReactionRolePanel(context, interaction.guildId, panelId);

    if (!message) {
      await interaction.reply({
        content: "無法發佈此面板，請檢查面板 ID 與頻道權限。",
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: `已發佈自助身分組面板：${message.url}`,
      ephemeral: true
    });
  }
};

export const reactionRoleCommands = [reactionRoleCommand] satisfies BotCommand[];
