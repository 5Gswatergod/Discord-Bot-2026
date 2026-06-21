import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { isGuildModuleEnabled } from "../../lib/modules";
import { requireGuildPermission } from "../../lib/permissions";
import { parseDurationToSeconds } from "../../lib/time";

export const reminderCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("reminder")
    .setNameLocalizations({ "zh-TW": "提醒" })
    .setDescription("管理伺服器提醒。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setNameLocalizations({ "zh-TW": "建立" })
        .setDescription("建立一次性或循環提醒。")
        .addStringOption((option) =>
          option
            .setName("after")
            .setNameLocalizations({ "zh-TW": "多久後" })
            .setDescription("例如 30m、2h 或 7d。")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setNameLocalizations({ "zh-TW": "訊息" })
            .setDescription("提醒內容。")
            .setRequired(true)
            .setMaxLength(2_000)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setNameLocalizations({ "zh-TW": "頻道" })
            .setDescription("發送提醒的頻道。")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addStringOption((option) =>
          option
            .setName("repeat")
            .setNameLocalizations({ "zh-TW": "重複間隔" })
            .setDescription("留空為一次性；例如 1h 或 1d。")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("cancel")
        .setNameLocalizations({ "zh-TW": "取消" })
        .setDescription("停用提醒。")
        .addStringOption((option) =>
          option
            .setName("reminder_id")
            .setNameLocalizations({ "zh-TW": "提醒_id" })
            .setDescription("提醒 ID。")
            .setRequired(true)
        )
    ),
  async execute(interaction, context) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "此指令只能在伺服器內使用。", ephemeral: true });
      return;
    }

    if (
      !(await requireGuildPermission(interaction, PermissionFlagsBits.ManageGuild, "管理伺服器"))
    ) {
      return;
    }

    if (!(await isGuildModuleEnabled(context.prisma, interaction.guildId, "REMINDERS"))) {
      await interaction.reply({ content: "此伺服器已停用提醒功能。", ephemeral: true });
      return;
    }

    if (interaction.options.getSubcommand() === "cancel") {
      const result = await context.prisma.reminder.updateMany({
        where: {
          id: interaction.options.getString("reminder_id", true),
          guildId: interaction.guildId
        },
        data: {
          enabled: false
        }
      });
      await interaction.reply({
        content: result.count > 0 ? "已停用提醒。" : "找不到提醒。",
        ephemeral: true
      });
      return;
    }

    const afterSeconds = parseDurationToSeconds(interaction.options.getString("after", true));
    const repeatValue = interaction.options.getString("repeat");
    const repeatSeconds = repeatValue ? parseDurationToSeconds(repeatValue) : null;

    if (!afterSeconds || (repeatValue && (!repeatSeconds || repeatSeconds < 60))) {
      await interaction.reply({
        content: "時間格式必須像 30m、2h 或 7d，循環間隔至少為 1 分鐘。",
        ephemeral: true
      });
      return;
    }

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;

    if (!channel || !("send" in channel)) {
      await interaction.reply({ content: "請選擇可發送訊息的文字頻道。", ephemeral: true });
      return;
    }

    const reminder = await context.prisma.reminder.create({
      data: {
        guildId: interaction.guildId,
        channelId: channel.id,
        message: interaction.options.getString("message", true),
        nextRunAt: new Date(Date.now() + afterSeconds * 1000),
        intervalSeconds: repeatSeconds,
        createdByUserId: interaction.user.id
      }
    });

    await interaction.reply({
      content: `已建立提醒 \`${reminder.id}\`，將於 <t:${Math.floor(reminder.nextRunAt.getTime() / 1000)}:F> 發送。`,
      ephemeral: true
    });
  }
};

export const reminderCommands = [reminderCommand] satisfies BotCommand[];
