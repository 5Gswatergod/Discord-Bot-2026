import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { economyMaxBalance } from "@guildforge/shared";

import type { BotCommand } from "../types";
import { EconomyError, adjustBalance, getEconomySettings } from "../../lib/economy/economy";
import { requireGuildPermission } from "../../lib/permissions";

export const economyAdminCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("economy-admin")
    .setNameLocalizations({ "zh-TW": "經濟管理" })
    .setDescription("管理成員的貨幣餘額。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setNameLocalizations({ "zh-TW": "增加" })
        .setDescription("增加成員的貨幣餘額。")
        .addUserOption((option) =>
          option
            .setName("user")
            .setNameLocalizations({ "zh-TW": "使用者" })
            .setDescription("要調整的成員。")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setNameLocalizations({ "zh-TW": "金額" })
            .setDescription("增加的金額。")
            .setMinValue(1)
            .setMaxValue(economyMaxBalance)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setNameLocalizations({ "zh-TW": "理由" })
            .setDescription("餘額調整理由。")
            .setMaxLength(256)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setNameLocalizations({ "zh-TW": "扣除" })
        .setDescription("扣除成員的貨幣餘額。")
        .addUserOption((option) =>
          option
            .setName("user")
            .setNameLocalizations({ "zh-TW": "使用者" })
            .setDescription("要調整的成員。")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setNameLocalizations({ "zh-TW": "金額" })
            .setDescription("扣除的金額。")
            .setMinValue(1)
            .setMaxValue(economyMaxBalance)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setNameLocalizations({ "zh-TW": "理由" })
            .setDescription("餘額調整理由。")
            .setMaxLength(256)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setNameLocalizations({ "zh-TW": "設定" })
        .setDescription("直接設定成員的貨幣餘額。")
        .addUserOption((option) =>
          option
            .setName("user")
            .setNameLocalizations({ "zh-TW": "使用者" })
            .setDescription("要調整的成員。")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setNameLocalizations({ "zh-TW": "金額" })
            .setDescription("新的餘額。")
            .setMinValue(0)
            .setMaxValue(economyMaxBalance)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setNameLocalizations({ "zh-TW": "理由" })
            .setDescription("餘額調整理由。")
            .setMaxLength(256)
            .setRequired(true)
        )
    ),
  async execute(interaction, context) {
    if (
      !interaction.guildId ||
      !(await requireGuildPermission(interaction, PermissionFlagsBits.ManageGuild, "管理伺服器"))
    ) {
      return;
    }

    const economy = await getEconomySettings(context.prisma, interaction.guildId);

    if (!economy.enabled) {
      await interaction.reply({
        content: "此伺服器已停用貨幣與商店功能。",
        ephemeral: true
      });
      return;
    }

    const mode = interaction.options.getSubcommand() as "add" | "remove" | "set";
    const user = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);
    const reason = interaction.options.getString("reason", true);

    try {
      const account = await adjustBalance(context.prisma, {
        guildId: interaction.guildId,
        userId: user.id,
        actorUserId: interaction.user.id,
        mode,
        amount,
        reason
      });
      await context.prisma.auditLog.create({
        data: {
          guildId: interaction.guildId,
          actorUserId: interaction.user.id,
          action: `ECONOMY_ADMIN_${mode.toUpperCase()}`,
          targetType: "EconomyAccount",
          targetId: account.id,
          metadata: {
            userId: user.id,
            amount,
            balance: account.balance,
            reason
          }
        }
      });
      await interaction.reply({
        content: `已更新 ${user.tag} 的餘額，目前為 ${account.balance.toLocaleString("zh-TW")} ${economy.settings.currencySymbol}。`,
        ephemeral: true
      });
    } catch (error) {
      if (error instanceof EconomyError) {
        await interaction.reply({
          content: error.message,
          ephemeral: true
        });
        return;
      }

      throw error;
    }
  }
};

export const economyAdminCommands = [economyAdminCommand] satisfies BotCommand[];
