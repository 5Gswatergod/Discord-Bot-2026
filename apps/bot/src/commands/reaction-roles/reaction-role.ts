import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { publishReactionRolePanel } from "../../lib/reaction-roles/reaction-roles";
import { isGuildModuleEnabled } from "../../lib/modules";

export const reactionRoleCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("reaction-role")
    .setDescription("Manage reaction role panels.")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("publish")
        .setDescription("Publish a configured reaction role panel.")
        .addStringOption((option) =>
          option.setName("panel_id").setDescription("Panel ID from the dashboard.").setRequired(true)
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
        content: "You need Manage Server permission to publish reaction role panels.",
        ephemeral: true
      });
      return;
    }

    const enabled = await isGuildModuleEnabled(context.prisma, interaction.guildId, "REACTION_ROLES");

    if (!enabled) {
      await interaction.reply({
        content: "Reaction Roles is disabled for this server.",
        ephemeral: true
      });
      return;
    }

    const panelId = interaction.options.getString("panel_id", true);
    const message = await publishReactionRolePanel(context, interaction.guildId, panelId);

    if (!message) {
      await interaction.reply({
        content: "Could not publish that panel. Check the panel ID and channel permissions.",
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: `Published reaction role panel: ${message.url}`,
      ephemeral: true
    });
  }
};

export const reactionRoleCommands = [reactionRoleCommand] satisfies BotCommand[];
