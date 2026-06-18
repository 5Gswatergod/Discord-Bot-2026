import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";

export const userInfoCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show basic information about a member.")
    .addUserOption((option) =>
      option.setName("user").setDescription("Member to inspect.").setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const member = interaction.guild?.members.cache.get(user.id);

    const embed = new EmbedBuilder()
      .setTitle(user.tag)
      .setThumbnail(user.displayAvatarURL())
      .setColor(0x24b47e)
      .addFields(
        {
          name: "User ID",
          value: user.id,
          inline: true
        },
        {
          name: "Account Created",
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
          inline: true
        }
      );

    if (member?.joinedTimestamp) {
      embed.addFields({
        name: "Joined Server",
        value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
        inline: true
      });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
