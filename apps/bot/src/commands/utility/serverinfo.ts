import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";

export const serverInfoCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show basic information about this server."),
  async execute(interaction) {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({
        content: "This command can only be used inside a server.",
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL())
      .setColor(0x24b47e)
      .addFields(
        {
          name: "Server ID",
          value: guild.id,
          inline: true
        },
        {
          name: "Members",
          value: guild.memberCount.toLocaleString(),
          inline: true
        },
        {
          name: "Created",
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
          inline: true
        }
      );

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
