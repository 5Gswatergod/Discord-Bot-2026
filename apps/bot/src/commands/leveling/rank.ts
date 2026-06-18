import { SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { buildRankEmbed, getLevelingSettings } from "../../lib/leveling/leveling";

export const rankCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Show a member's level and rank.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName("user").setDescription("Member to inspect.").setRequired(false)
    ),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used inside a server.",
        ephemeral: true
      });
      return;
    }

    const { enabled } = await getLevelingSettings(context, interaction.guildId);

    if (!enabled) {
      await interaction.reply({
        content: "Leveling is disabled for this server.",
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
        content: `${user.tag} has not earned XP yet.`,
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
    .setDescription("Show the server XP leaderboard.")
    .setDMPermission(false),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used inside a server.",
        ephemeral: true
      });
      return;
    }

    const { enabled } = await getLevelingSettings(context, interaction.guildId);

    if (!enabled) {
      await interaction.reply({
        content: "Leveling is disabled for this server.",
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
        content: "No XP has been earned yet.",
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: users
        .map(
          (user, index) =>
            `#${index + 1} <@${user.userId}> - Level ${user.level}, ${user.xp.toLocaleString()} XP`
        )
        .join("\n"),
      ephemeral: true
    });
  }
};
