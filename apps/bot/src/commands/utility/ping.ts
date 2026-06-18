import { SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";

export const pingCommand: BotCommand = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check bot latency."),
  async execute(interaction) {
    await interaction.reply({
      content: `Pong. WebSocket latency: ${interaction.client.ws.ping}ms.`,
      ephemeral: true
    });
  }
};
