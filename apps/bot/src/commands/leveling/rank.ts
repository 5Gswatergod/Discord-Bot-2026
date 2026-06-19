import { SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { buildRankEmbed, getLevelingSettings } from "../../lib/leveling/leveling";

export const rankCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setNameLocalizations({ "zh-TW": "等級" })
    .setDescription("顯示成員的等級與排名。")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "使用者" })
        .setDescription("要查看的成員。")
        .setRequired(false)
    ),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "此指令只能在伺服器內使用。",
        ephemeral: true
      });
      return;
    }

    const { enabled } = await getLevelingSettings(context, interaction.guildId);

    if (!enabled) {
      await interaction.reply({
        content: "此伺服器已停用等級功能。",
        ephemeral: true
      });
      return;
    }

    const user = interaction.options.getUser("user") ?? interaction.user;
    const record = await context.prisma.levelingUser.findUnique({
      where: {
        guildId_userId: {
          guildId: interaction.guildId,
          userId: user.id
        }
      }
    });

    if (!record) {
      await interaction.reply({
        content: `${user.tag} 尚未獲得任何經驗值。`,
        ephemeral: true
      });
      return;
    }

    const higherRanked = await context.prisma.levelingUser.count({
      where: {
        guildId: interaction.guildId,
        OR: [
          {
            xp: {
              gt: record.xp
            }
          },
          {
            xp: record.xp,
            updatedAt: {
              lt: record.updatedAt
            }
          }
        ]
      }
    });

    await interaction.reply({
      embeds: [
        buildRankEmbed({
          username: user.tag,
          avatarUrl: user.displayAvatarURL(),
          xp: record.xp,
          level: record.level,
          rank: higherRanked + 1,
          messageCount: record.messageCount
        })
      ],
      ephemeral: true
    });
  }
};

export const leaderboardCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setNameLocalizations({ "zh-TW": "排行榜" })
    .setDescription("顯示伺服器經驗值排行榜。")
    .setDMPermission(false),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "此指令只能在伺服器內使用。",
        ephemeral: true
      });
      return;
    }

    const { enabled } = await getLevelingSettings(context, interaction.guildId);

    if (!enabled) {
      await interaction.reply({
        content: "此伺服器已停用等級功能。",
        ephemeral: true
      });
      return;
    }

    const users = await context.prisma.levelingUser.findMany({
      where: {
        guildId: interaction.guildId
      },
      orderBy: [
        {
          xp: "desc"
        },
        {
          updatedAt: "asc"
        }
      ],
      take: 10
    });

    if (users.length === 0) {
      await interaction.reply({
        content: "目前尚無任何經驗值紀錄。",
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: users
        .map(
          (user, index) =>
            `#${index + 1} <@${user.userId}> - 等級 ${user.level}，${user.xp.toLocaleString("zh-TW")} 經驗值`
        )
        .join("\n"),
      ephemeral: true
    });
  }
};
