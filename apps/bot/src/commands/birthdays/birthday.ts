import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { birthdaySettingsSchema } from "@guildforge/shared";

import type { BotCommand } from "../types";
import { daysUntilBirthday, isValidBirthday } from "../../lib/birthdays/birthdays";
import { getGuildModuleSettings } from "../../lib/modules";

export const birthdayCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setNameLocalizations({ "zh-TW": "生日" })
    .setDescription("登記或查看生日。")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setNameLocalizations({ "zh-TW": "設定" })
        .setDescription("設定自己的生日。")
        .addIntegerOption((option) =>
          option
            .setName("month")
            .setNameLocalizations({ "zh-TW": "月份" })
            .setDescription("生日月份。")
            .setMinValue(1)
            .setMaxValue(12)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("day")
            .setNameLocalizations({ "zh-TW": "日期" })
            .setDescription("生日日期。")
            .setMinValue(1)
            .setMaxValue(31)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("year")
            .setNameLocalizations({ "zh-TW": "年份" })
            .setDescription("出生年份，可留空。")
            .setMinValue(1900)
            .setMaxValue(new Date().getUTCFullYear())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setNameLocalizations({ "zh-TW": "移除" })
        .setDescription("移除自己的生日資料。")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("upcoming")
        .setNameLocalizations({ "zh-TW": "即將到來" })
        .setDescription("查看近期生日。")
    ),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "此指令只能在伺服器內使用。", ephemeral: true });
      return;
    }

    const config = await getGuildModuleSettings(context.prisma, interaction.guildId, "BIRTHDAYS");

    if (!config.enabled) {
      await interaction.reply({ content: "此伺服器已停用生日功能。", ephemeral: true });
      return;
    }

    const settings = birthdaySettingsSchema.parse(config.settings ?? {});
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const month = interaction.options.getInteger("month", true);
      const day = interaction.options.getInteger("day", true);
      const year = interaction.options.getInteger("year");

      if (!isValidBirthday(month, day, year)) {
        await interaction.reply({ content: "生日日期不正確。", ephemeral: true });
        return;
      }

      await context.prisma.birthday.upsert({
        where: {
          guildId_userId: {
            guildId: interaction.guildId,
            userId: interaction.user.id
          }
        },
        create: {
          guildId: interaction.guildId,
          userId: interaction.user.id,
          month,
          day,
          year
        },
        update: {
          month,
          day,
          year,
          lastCelebratedYear: null
        }
      });
      await interaction.reply({
        content: `已將你的生日設定為 ${month} 月 ${day} 日。`,
        ephemeral: true
      });
      return;
    }

    if (subcommand === "remove") {
      await context.prisma.birthday.deleteMany({
        where: {
          guildId: interaction.guildId,
          userId: interaction.user.id
        }
      });
      await interaction.reply({ content: "已移除你的生日資料。", ephemeral: true });
      return;
    }

    const birthdays = await context.prisma.birthday.findMany({
      where: {
        guildId: interaction.guildId
      }
    });
    const upcoming = birthdays
      .map((birthday) => ({
        ...birthday,
        days: daysUntilBirthday(
          birthday.month,
          birthday.day,
          settings.timeZone
        )
      }))
      .filter((birthday) => birthday.days <= settings.upcomingDays)
      .sort((left, right) => left.days - right.days)
      .slice(0, 20);

    if (upcoming.length === 0) {
      await interaction.reply(`未來 ${settings.upcomingDays} 天沒有已登記的生日。`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xec4899)
      .setTitle("即將到來的生日")
      .setDescription(
        upcoming
          .map(
            (birthday) =>
              `🎂 <@${birthday.userId}> — ${birthday.month}/${birthday.day}（${birthday.days === 0 ? "今天" : `${birthday.days} 天後`}）`
          )
          .join("\n")
      );

    await interaction.reply({ embeds: [embed] });
  }
};

export const birthdayCommands = [birthdayCommand] satisfies BotCommand[];
