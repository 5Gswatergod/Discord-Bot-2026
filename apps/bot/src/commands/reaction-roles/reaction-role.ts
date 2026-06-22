import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { syncReactionRolePanels } from "../../lib/reaction-roles/reaction-roles";
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
        .setName("sync")
        .setNameLocalizations({ "zh-TW": "同步" })
        .setDescription("立即同步這個伺服器的所有自助身分組面板。")
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

    const enabled = await isGuildModuleEnabled(
      context.prisma,
      interaction.guildId,
      "REACTION_ROLES"
    );

    if (!enabled) {
      await interaction.reply({
        content: "此伺服器已停用自助身分組功能。",
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const summary = await syncReactionRolePanels(context, interaction.guildId);

    await interaction.editReply(
      `同步完成：新增 ${summary.created}、更新 ${summary.updated}、刪除 ${summary.deleted}、失敗 ${summary.failed}。`
    );
  }
};

export const reactionRoleCommands = [reactionRoleCommand] satisfies BotCommand[];
