import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { EconomyShopItemStatus, EconomyShopItemType } from "@guildforge/database";

import type { BotCommand } from "../types";
import {
  EconomyError,
  getEconomySettings,
  purchaseShopItem,
  refundRolePurchase
} from "../../lib/economy/economy";

const pageSize = 10;

function formatMoney(amount: number, symbol: string) {
  return `${amount.toLocaleString("zh-TW")} ${symbol}`;
}

export const shopCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setNameLocalizations({ "zh-TW": "商店" })
    .setDescription("查看商店或購買商品。")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setNameLocalizations({ "zh-TW": "列表" })
        .setDescription("查看目前上架中的商品。")
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
        .setName("buy")
        .setNameLocalizations({ "zh-TW": "購買" })
        .setDescription("購買商店商品。")
        .addStringOption((option) =>
          option
            .setName("item")
            .setNameLocalizations({ "zh-TW": "商品" })
            .setDescription("要購買的商品。")
            .setAutocomplete(true)
            .setRequired(true)
        )
    ),
  async autocomplete(interaction, context) {
    if (!interaction.guildId) {
      await interaction.respond([]);
      return;
    }

    const focused = interaction.options.getFocused().trim();
    const items = await context.prisma.economyShopItem.findMany({
      where: {
        guildId: interaction.guildId,
        status: EconomyShopItemStatus.ACTIVE,
        ...(focused
          ? {
              name: {
                contains: focused,
                mode: "insensitive"
              }
            }
          : {})
      },
      orderBy: {
        name: "asc"
      },
      take: 25
    });
    await interaction.respond(
      items.map((item) => ({
        name: `${item.name} — ${item.price.toLocaleString("zh-TW")}`.slice(0, 100),
        value: item.id
      }))
    );
  },
  async execute(interaction, context) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "此指令只能在伺服器內使用。",
        ephemeral: true
      });
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

    if (interaction.options.getSubcommand() === "list") {
      const page = interaction.options.getInteger("page") ?? 1;
      const items = await context.prisma.economyShopItem.findMany({
        where: {
          guildId: interaction.guildId,
          status: EconomyShopItemStatus.ACTIVE
        },
        orderBy: {
          createdAt: "asc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      });

      if (items.length === 0) {
        await interaction.reply({
          content: "商店目前沒有上架中的商品。",
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle(`${economy.settings.currencyName}商店`)
            .setDescription(
              items
                .map((item) => {
                  const stock =
                    item.stock === null
                      ? "無限"
                      : Math.max(0, item.stock - item.soldCount).toLocaleString("zh-TW");
                  return `**${item.name}** — ${formatMoney(item.price, economy.settings.currencySymbol)}\n${item.description || "無商品說明"}\n剩餘庫存：${stock}`;
                })
                .join("\n\n")
            )
            .setFooter({
              text: `第 ${page} 頁`
            })
        ],
        ephemeral: true
      });
      return;
    }

    const itemId = interaction.options.getString("item", true);
    const item = await context.prisma.economyShopItem.findFirst({
      where: {
        id: itemId,
        guildId: interaction.guildId
      }
    });

    if (!item) {
      await interaction.reply({
        content: "找不到此商店商品。",
        ephemeral: true
      });
      return;
    }

    if (item.type === EconomyShopItemType.ROLE) {
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      const role = item.roleId
        ? await interaction.guild.roles.fetch(item.roleId).catch(() => null)
        : null;

      if (!member || !role || !role.editable) {
        await interaction.reply({
          content: "此身分組商品目前無法發放，請通知伺服器管理員。",
          ephemeral: true
        });
        return;
      }

      if (member.roles.cache.has(role.id)) {
        await interaction.reply({
          content: "你已經擁有此身分組。",
          ephemeral: true
        });
        return;
      }
    }

    try {
      const result = await purchaseShopItem(context.prisma, {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        itemId
      });

      if (result.item.type === EconomyShopItemType.ROLE && result.item.roleId) {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

        try {
          if (!member) {
            throw new Error("Member left the guild before role assignment.");
          }

          await member.roles.add(result.item.roleId, `購買商店商品：${result.item.name}`);
        } catch (error) {
          await refundRolePurchase(context.prisma, {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            itemId: result.item.id,
            referenceId: result.referenceId,
            reason: "身分組發放失敗，自動退款"
          });
          context.logger.warn("Failed to assign purchased economy role", {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            itemId: result.item.id,
            error
          });
          await interaction.reply({
            content: "身分組發放失敗，系統已自動退款。",
            ephemeral: true
          });
          return;
        }
      }

      await interaction.reply({
        content: `已購買「${result.item.name}」，剩餘餘額 ${formatMoney(result.balance, economy.settings.currencySymbol)}。`,
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

export const shopCommands = [shopCommand] satisfies BotCommand[];
