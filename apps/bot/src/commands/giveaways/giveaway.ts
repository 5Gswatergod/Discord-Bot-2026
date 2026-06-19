import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { GiveawayStatus } from "@guildforge/database";

import type { BotCommand } from "../types";
import { createGiveawayMessage, endGiveaway } from "../../lib/giveaways/giveaways";
import { isSendableGuildTextChannel } from "../../lib/channels";
import { isGuildModuleEnabled } from "../../lib/modules";
import { parseDurationToSeconds } from "../../lib/time";

export const giveawayCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setNameLocalizations({ "zh-TW": "抽獎" })
    .setDescription("管理抽獎。")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setNameLocalizations({ "zh-TW": "建立" })
        .setDescription("建立抽獎。")
        .addStringOption((option) =>
          option
            .setName("prize")
            .setNameLocalizations({ "zh-TW": "獎品" })
            .setDescription("要抽出的獎品。")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("duration")
            .setNameLocalizations({ "zh-TW": "持續時間" })
            .setDescription("持續時間，例如 30m、2h 或 7d。")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("winners")
            .setNameLocalizations({ "zh-TW": "得獎人數" })
            .setDescription("得獎人數。")
            .setMinValue(1)
            .setMaxValue(25)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setNameLocalizations({ "zh-TW": "頻道" })
            .setDescription("發佈抽獎的頻道。")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addRoleOption((option) =>
          option
            .setName("required_role")
            .setNameLocalizations({ "zh-TW": "必要身分組" })
            .setDescription("參加抽獎所需的身分組。")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("end")
        .setNameLocalizations({ "zh-TW": "結束" })
        .setDescription("立即結束抽獎。")
        .addStringOption((option) =>
          option
            .setName("giveaway_id")
            .setNameLocalizations({ "zh-TW": "抽獎_id" })
            .setDescription("抽獎 ID。")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reroll")
        .setNameLocalizations({ "zh-TW": "重抽" })
        .setDescription("為已結束的抽獎重新抽出得獎者。")
        .addStringOption((option) =>
          option
            .setName("giveaway_id")
            .setNameLocalizations({ "zh-TW": "抽獎_id" })
            .setDescription("抽獎 ID。")
            .setRequired(true)
        )
    ),
  async execute(interaction, context) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "此指令只能在伺服器內使用。",
        ephemeral: true
      });
      return;
    }

    if (!interaction.memberPermissions?.any([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild])) {
      await interaction.reply({
        content: "你需要「管理伺服器」權限才能管理抽獎。",
        ephemeral: true
      });
      return;
    }

    const enabled = await isGuildModuleEnabled(context.prisma, interaction.guildId, "GIVEAWAYS");

    if (!enabled) {
      await interaction.reply({
        content: "此伺服器已停用抽獎功能。",
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const duration = interaction.options.getString("duration", true);
      const durationSeconds = parseDurationToSeconds(duration);

      if (!durationSeconds) {
        await interaction.reply({
          content: "持續時間格式必須像 30m、2h 或 7d。",
          ephemeral: true
        });
        return;
      }

      const channel = interaction.options.getChannel("channel") ?? interaction.channel;

      if (!isSendableGuildTextChannel(channel)) {
        await interaction.reply({
          content: "抽獎必須發佈在文字頻道。",
          ephemeral: true
        });
        return;
      }

      const giveaway = await context.prisma.giveaway.create({
        data: {
          guildId: interaction.guildId,
          channelId: channel.id,
          prize: interaction.options.getString("prize", true),
          winnerCount: interaction.options.getInteger("winners") ?? 1,
          requiredRoleId: interaction.options.getRole("required_role")?.id,
          createdByUserId: interaction.user.id,
          endsAt: new Date(Date.now() + durationSeconds * 1000),
          status: GiveawayStatus.ACTIVE
        }
      });
      const message = await createGiveawayMessage(context, giveaway);

      await interaction.reply({
        content: message
          ? `已建立抽獎 ${giveaway.id}：${message.url}`
          : `已建立抽獎 ${giveaway.id}，但無法傳送 Discord 訊息。`,
        ephemeral: true
      });
      return;
    }

    const giveawayId = interaction.options.getString("giveaway_id", true);
    const ended = await endGiveaway(context, giveawayId, subcommand === "reroll");

    await interaction.reply({
      content: ended
        ? `已${subcommand === "reroll" ? "重新抽取" : "結束"}抽獎 ${giveawayId}。`
        : "找不到抽獎，或抽獎已經結束。",
      ephemeral: true
    });
  }
};

export const giveawayCommands = [giveawayCommand] satisfies BotCommand[];
