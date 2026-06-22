import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { achievementTriggerLabels } from "@guildforge/shared";

import type { BotCommand } from "../types";
import { getAchievementProgress } from "../../lib/achievements/achievements";
import { isGuildModuleEnabled } from "../../lib/modules";

export const achievementsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("achievements")
    .setNameLocalizations({ "zh-TW": "成就" })
    .setDescription("查看成員的成就進度。")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "成員" })
        .setDescription("要查看的成員。")
    ),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "此指令只能在伺服器內使用。", ephemeral: true });
      return;
    }

    if (!(await isGuildModuleEnabled(context.prisma, interaction.guildId, "ACHIEVEMENTS"))) {
      await interaction.reply({ content: "此伺服器已停用成就功能。", ephemeral: true });
      return;
    }

    const user = interaction.options.getUser("user") ?? interaction.user;
    const progress = await getAchievementProgress(context, interaction.guildId, user.id);

    if (progress.length === 0) {
      await interaction.reply({ content: "此伺服器尚未建立成就。", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2dd4bf)
      .setTitle(`${user.username} 的成就`)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(
        progress
          .map(({ achievement, progress: current, awardedAt }) => {
            const status = awardedAt ? "✅" : "⬜";
            return `${status} ${achievement.icon ?? "🏆"} **${achievement.name}**\n${achievement.description ?? achievementTriggerLabels[achievement.trigger]} · ${Math.min(current, achievement.threshold)}/${achievement.threshold}`;
          })
          .join("\n\n")
      );

    await interaction.reply({ embeds: [embed] });
  }
};

export const achievementCommands = [achievementsCommand] satisfies BotCommand[];
