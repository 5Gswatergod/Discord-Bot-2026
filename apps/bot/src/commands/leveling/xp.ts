import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { leaderboardCommand, rankCommand } from "./rank";

export const xpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Manage XP records.")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reset")
        .setDescription("Reset XP for one member or the whole server.")
        .addUserOption((option) =>
          option.setName("user").setDescription("Member to reset. Leave empty for all members.")
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
        content: "You need Manage Server permission to reset XP.",
        ephemeral: true
      });
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
        content: `Reset XP for ${user.tag}.`,
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
      content: `Reset XP for ${result.count} members.`,
      ephemeral: true
    });
  }
};

export const levelingCommands = [rankCommand, leaderboardCommand, xpCommand] satisfies BotCommand[];
