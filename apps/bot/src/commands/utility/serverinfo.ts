import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";

export const serverInfoCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setNameLocalizations({ "zh-TW": "伺服器資訊" })
    .setDescription("顯示此伺服器的基本資訊。"),
  async execute(interaction) {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({
        content: "此指令只能在伺服器內使用。",
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
          name: "伺服器 ID",
          value: guild.id,
          inline: true
        },
        {
          name: "成員數",
          value: guild.memberCount.toLocaleString("zh-TW"),
          inline: true
        },
        {
          name: "建立時間",
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
