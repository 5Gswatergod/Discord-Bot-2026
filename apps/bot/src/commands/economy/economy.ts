import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { economyMaxBalance } from "@guildforge/shared";

import type { BotCommand } from "../types";
import {
  EconomyError,
  claimDailyReward,
  getEconomyAccount,
  getEconomySettings,
  transferCurrency
} from "../../lib/economy/economy";

const pageSize = 10;

function formatMoney(amount: number, symbol: string) {
  return `${amount.toLocaleString("zh-TW")} ${symbol}`;
}

async function requireEconomy(
  interaction: Parameters<BotCommand["execute"]>[0],
  context: Parameters<BotCommand["execute"]>[1]
) {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "此指令只能在伺服器內使用。",
      ephemeral: true
    });
    return null;
  }

  const economy = await getEconomySettings(context.prisma, interaction.guildId);

  if (!economy.enabled) {
    await interaction.reply({
      content: "此伺服器已停用貨幣與商店功能。",
      ephemeral: true
    });
    return null;
  }

  return {
    guildId: interaction.guildId,
    settings: economy.settings
  };
}

export const economyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setNameLocalizations({ "zh-TW": "經濟" })
    .setDescription("查看餘額、領取每日獎勵、轉帳與排行榜。")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("balance")
        .setNameLocalizations({ "zh-TW": "餘額" })
        .setDescription("查看自己或其他成員的貨幣餘額。")
        .addUserOption((option) =>
          option
            .setName("user")
            .setNameLocalizations({ "zh-TW": "使用者" })
            .setDescription("要查看的成員。")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("daily")
        .setNameLocalizations({ "zh-TW": "每日" })
        .setDescription("領取每日貨幣獎勵。")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("pay")
        .setNameLocalizations({ "zh-TW": "轉帳" })
        .setDescription("轉帳貨幣給其他成員。")
        .addUserOption((option) =>
          option
            .setName("user")
            .setNameLocalizations({ "zh-TW": "使用者" })
            .setDescription("收款成員。")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("amount")
            .setNameLocalizations({ "zh-TW": "金額" })
            .setDescription("轉帳金額。")
            .setMinValue(1)
            .setMaxValue(economyMaxBalance)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leaderboard")
        .setNameLocalizations({ "zh-TW": "排行榜" })
        .setDescription("查看貨幣餘額排行榜。")
        .addIntegerOption((option) =>
          option
            .setName("page")
            .setNameLocalizations({ "zh-TW": "頁數" })
            .setDescription("要查看的頁數。")
            .setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("inventory")
        .setNameLocalizations({ "zh-TW": "庫存" })
        .setDescription("查看自己或其他成員持有的商店商品。")
        .addUserOption((option) =>
          option
            .setName("user")
            .setNameLocalizations({ "zh-TW": "使用者" })
            .setDescription("要查看的成員。")
        )
        .addIntegerOption((option) =>
          option
            .setName("page")
            .setNameLocalizations({ "zh-TW": "頁數" })
            .setDescription("要查看的頁數。")
            .setMinValue(1)
        )
    ),
  async execute(interaction, context) {
    const economy = await requireEconomy(interaction, context);

    if (!economy) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "balance") {
      const user = interaction.options.getUser("user") ?? interaction.user;
      const account = await getEconomyAccount(context.prisma, economy.guildId, user.id);
      await interaction.reply({
        content: `${user.id === interaction.user.id ? "你的" : `${user.tag} 的`}餘額為 ${formatMoney(account.balance, economy.settings.currencySymbol)}。`,
        ephemeral: true
      });
      return;
    }

    if (subcommand === "daily") {
      try {
        const result = await claimDailyReward(
          context.prisma,
          economy.guildId,
          interaction.user.id,
          economy.settings
        );
        await interaction.reply({
          content: `你領取了 ${formatMoney(result.amount, economy.settings.currencySymbol)}，目前餘額 ${formatMoney(result.balance, economy.settings.currencySymbol)}，連續簽到 ${result.streak} 天。`,
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
      return;
    }

    if (subcommand === "pay") {
      const recipient = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);

      if (recipient.id === interaction.user.id) {
        await interaction.reply({
          content: "你不能轉帳給自己。",
          ephemeral: true
        });
        return;
      }

      if (recipient.bot) {
        await interaction.reply({
          content: "你不能轉帳給機器人帳號。",
          ephemeral: true
        });
        return;
      }

      if (amount < economy.settings.minimumTransfer) {
        await interaction.reply({
          content: `最低轉帳金額為 ${formatMoney(economy.settings.minimumTransfer, economy.settings.currencySymbol)}。`,
          ephemeral: true
        });
        return;
      }

      try {
        const result = await transferCurrency(context.prisma, {
          guildId: economy.guildId,
          senderUserId: interaction.user.id,
          recipientUserId: recipient.id,
          amount,
          settings: economy.settings
        });
        const feeText =
          result.fee > 0
            ? `，另支付手續費 ${formatMoney(result.fee, economy.settings.currencySymbol)}`
            : "";
        await interaction.reply({
          content: `已轉帳 ${formatMoney(amount, economy.settings.currencySymbol)} 給 ${recipient.tag}${feeText}。剩餘餘額 ${formatMoney(result.senderBalance, economy.settings.currencySymbol)}。`,
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
      return;
    }

    if (subcommand === "leaderboard") {
      const page = interaction.options.getInteger("page") ?? 1;
      const accounts = await context.prisma.economyAccount.findMany({
        where: {
          guildId: economy.guildId,
          balance: {
            gt: 0
          }
        },
        orderBy: [
          {
            balance: "desc"
          },
          {
            updatedAt: "asc"
          }
        ],
        skip: (page - 1) * pageSize,
        take: pageSize
      });

      if (accounts.length === 0) {
        await interaction.reply({
          content: "此頁目前沒有貨幣紀錄。",
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x24b47e)
            .setTitle(`${economy.settings.currencyName}排行榜`)
            .setDescription(
              accounts
                .map(
                  (account, index) =>
                    `#${(page - 1) * pageSize + index + 1} <@${account.userId}> — ${formatMoney(account.balance, economy.settings.currencySymbol)}`
                )
                .join("\n")
            )
            .setFooter({
              text: `第 ${page} 頁`
            })
        ],
        ephemeral: true
      });
      return;
    }

    const user = interaction.options.getUser("user") ?? interaction.user;
    const page = interaction.options.getInteger("page") ?? 1;
    const inventory = await context.prisma.economyInventoryItem.findMany({
      where: {
        guildId: economy.guildId,
        userId: user.id,
        quantity: {
          gt: 0
        }
      },
      include: {
        shopItem: true
      },
      orderBy: {
        updatedAt: "desc"
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    if (inventory.length === 0) {
      await interaction.reply({
        content: `${user.id === interaction.user.id ? "你的" : `${user.tag} 的`}庫存目前沒有商品。`,
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x24b47e)
          .setTitle(`${user.tag} 的庫存`)
          .setDescription(
            inventory.map((entry) => `**${entry.shopItem.name}** × ${entry.quantity}`).join("\n")
          )
          .setFooter({
            text: `第 ${page} 頁`
          })
      ],
      ephemeral: true
    });
  }
};

export const economyCommands = [economyCommand] satisfies BotCommand[];
