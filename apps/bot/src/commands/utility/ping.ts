import { SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";

export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setNameLocalizations({ "zh-TW": "延遲" })
    .setDescription("檢查機器人延遲。"),
  async execute(interaction) {
    await interaction.reply({
      content: `回應成功。WebSocket 延遲：${interaction.client.ws.ping} 毫秒。`,
      ephemeral: true
    });
  }
};
