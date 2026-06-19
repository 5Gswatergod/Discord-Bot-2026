import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { isGuildModuleEnabled } from "../../lib/modules";
import { requireGuildPermission } from "../../lib/permissions";
import { checkSocialAlerts, testSocialAlert } from "../../lib/social-alerts/social-alerts";

export const socialAlertCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("social-alert")
    .setNameLocalizations({ "zh-TW": "社群通知" })
    .setDescription("管理社群通知檢查。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("check")
        .setNameLocalizations({ "zh-TW": "檢查" })
        .setDescription("立即檢查此伺服器的社群通知。")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("test")
        .setNameLocalizations({ "zh-TW": "測試" })
        .setDescription("以最新項目測試傳送通知。")
        .addStringOption((option) =>
          option
            .setName("alert_id")
            .setNameLocalizations({ "zh-TW": "通知_id" })
            .setDescription("社群通知 ID。")
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

    const enabled = await isGuildModuleEnabled(context.prisma, interaction.guildId, "SOCIAL_ALERTS");

    if (!enabled) {
      await interaction.reply({
        content: "此伺服器已停用社群通知功能。",
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({
      ephemeral: true
    });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "test") {
      const result = await testSocialAlert(
        context,
        interaction.guildId,
        interaction.options.getString("alert_id", true)
      );

      await interaction.editReply(result.message);
      return;
    }

    const summary = await checkSocialAlerts(context, {
      guildId: interaction.guildId,
      force: true
    });

    await interaction.editReply(
      `已檢查 ${summary.checked} 個通知。已傳送 ${summary.sent} 個、建立基準 ${summary.baselined} 個、無變更 ${summary.unchanged} 個、略過 ${summary.skipped} 個、失敗 ${summary.failed} 個。`
    );
  }
};

export const socialAlertCommands = [socialAlertCommand] satisfies BotCommand[];
