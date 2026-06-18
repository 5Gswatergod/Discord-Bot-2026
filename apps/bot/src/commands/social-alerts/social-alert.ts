import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { isGuildModuleEnabled } from "../../lib/modules";
import { checkSocialAlerts, testSocialAlert } from "../../lib/social-alerts/social-alerts";

export const socialAlertCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("social-alert")
    .setDescription("Manage social alert checks.")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand.setName("check").setDescription("Check social alerts for this server now.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("test")
        .setDescription("Send the latest item from an alert as a test.")
        .addStringOption((option) =>
          option.setName("alert_id").setDescription("Social alert ID.").setRequired(true)
        )
    ),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used inside a server.",
        ephemeral: true
      });
      return;
    }

    if (!interaction.memberPermissions?.any([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild])) {
      await interaction.reply({
        content: "You need Manage Server permission to manage social alerts.",
        ephemeral: true
      });
      return;
    }

    const enabled = await isGuildModuleEnabled(context.prisma, interaction.guildId, "SOCIAL_ALERTS");

    if (!enabled) {
      await interaction.reply({
        content: "Social alerts are disabled for this server.",
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
      `Checked ${summary.checked} alerts. Sent ${summary.sent}, baselined ${summary.baselined}, unchanged ${summary.unchanged}, skipped ${summary.skipped}, failed ${summary.failed}.`
    );
  }
};

export const socialAlertCommands = [socialAlertCommand] satisfies BotCommand[];
