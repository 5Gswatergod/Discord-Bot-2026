import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { PollVisibility } from "@guildforge/database";

import type { BotCommand } from "../types";
import { isSendableGuildTextChannel } from "../../lib/channels";
import { isGuildModuleEnabled } from "../../lib/modules";
import { requireGuildPermission } from "../../lib/permissions";
import { publishPollMessage } from "../../lib/polls/polls";
import { parseDurationToSeconds } from "../../lib/time";

export const pollCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setNameLocalizations({ "zh-TW": "投票" })
    .setDescription("建立投票。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setNameLocalizations({ "zh-TW": "建立" })
        .setDescription("建立按鈕投票。")
        .addStringOption((option) =>
          option
            .setName("question")
            .setNameLocalizations({ "zh-TW": "問題" })
            .setDescription("投票問題。")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("options")
            .setNameLocalizations({ "zh-TW": "選項" })
            .setDescription("使用 | 分隔 2 至 10 個選項。")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("visibility")
            .setNameLocalizations({ "zh-TW": "結果顯示" })
            .setDescription("是否顯示投票結果。")
            .addChoices(
              { name: "公開", value: "PUBLIC" },
              { name: "匿名", value: "ANONYMOUS" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("duration")
            .setNameLocalizations({ "zh-TW": "持續時間" })
            .setDescription("選填的持續時間，例如 1h 或 3d。")
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setNameLocalizations({ "zh-TW": "頻道" })
            .setDescription("發佈投票的頻道。")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    ),
  async execute(interaction, context) {
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: "此指令只能在伺服器內使用。",
        ephemeral: true
      });
      return;
    }

    if (
      !(await requireGuildPermission(
        interaction,
        PermissionFlagsBits.ManageGuild,
        "管理伺服器"
      ))
    ) {
      return;
    }

    const enabled = await isGuildModuleEnabled(context.prisma, guildId, "POLLS");

    if (!enabled) {
      await interaction.reply({
        content: "此伺服器已停用投票功能。",
        ephemeral: true
      });
      return;
    }

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;

    if (!isSendableGuildTextChannel(channel)) {
      await interaction.reply({
        content: "投票必須發佈在文字頻道。",
        ephemeral: true
      });
      return;
    }

    const labels = interaction.options
      .getString("options", true)
      .split("|")
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (labels.length < 2) {
      await interaction.reply({
        content: "請提供至少 2 個以 | 分隔的選項。",
        ephemeral: true
      });
      return;
    }

    const duration = interaction.options.getString("duration");
    const durationSeconds = duration ? parseDurationToSeconds(duration) : null;

    if (duration && !durationSeconds) {
      await interaction.reply({
        content: "持續時間格式必須像 1h 或 3d。",
        ephemeral: true
      });
      return;
    }

    const poll = await context.prisma.poll.create({
      data: {
        guildId,
        channelId: channel.id,
        question: interaction.options.getString("question", true),
        visibility: (interaction.options.getString("visibility") ?? "PUBLIC") as PollVisibility,
        createdByUserId: interaction.user.id,
        endsAt: durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null,
        options: {
          create: labels.map((label, index) => ({
            guildId,
            label,
            sortOrder: index
          }))
        }
      }
    });
    const message = await publishPollMessage(context, poll.id);

    await interaction.reply({
      content: message ? `已建立投票 ${poll.id}：${message.url}` : `已建立投票 ${poll.id}。`,
      ephemeral: true
    });
  }
};

export const pollCommands = [pollCommand] satisfies BotCommand[];
