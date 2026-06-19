import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";

export const userInfoCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setNameLocalizations({ "zh-TW": "使用者資訊" })
    .setDescription("顯示成員的基本資訊。")
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "使用者" })
        .setDescription("要查看的成員。")
        .setRequired(false)
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
          name: "使用者 ID",
          value: user.id,
          inline: true
        },
        {
          name: "帳號建立時間",
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
          inline: true
        }
      );

    if (member?.joinedTimestamp) {
      embed.addFields({
        name: "加入伺服器時間",
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
