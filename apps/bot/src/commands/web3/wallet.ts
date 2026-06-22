import { randomBytes } from "node:crypto";

import {
  SlashCommandBuilder
} from "discord.js";
import {
  getAddress,
  verifyMessage
} from "ethers";

import {
  web3SettingsSchema,
  web3WalletAddressSchema,
  web3WalletSignatureSchema
} from "@guildforge/shared";

import type { BotCommand } from "../types";
import { getGuildModuleSettings } from "../../lib/modules";
import { verifyWalletHoldings } from "../../lib/web3/web3";

function buildChallenge(input: {
  guildId: string;
  userId: string;
  address: string;
  nonce: string;
  expiresAt: Date;
}) {
  return [
    "Hydrava wallet verification",
    `Guild: ${input.guildId}`,
    `Discord user: ${input.userId}`,
    `Wallet: ${input.address}`,
    `Nonce: ${input.nonce}`,
    `Expires: ${input.expiresAt.toISOString()}`
  ].join("\n");
}

const walletCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("連結並驗證 EVM 錢包。")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("challenge")
        .setDescription("產生錢包簽章內容。")
        .addStringOption((option) =>
          option.setName("address").setDescription("0x 開頭的 EVM 錢包地址").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("verify")
        .setDescription("提交錢包簽章。")
        .addStringOption((option) =>
          option.setName("signature").setDescription("錢包簽署後的 Signature").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("status").setDescription("查看目前錢包與 NFT 驗證狀態。")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("unlink").setDescription("解除目前連結的錢包。")
    ),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      return;
    }

    const moduleConfig = await getGuildModuleSettings(
      context.prisma,
      interaction.guildId,
      "WEB3"
    );

    if (!moduleConfig.enabled) {
      await interaction.reply({ content: "此伺服器尚未啟用 Web3 驗證。", ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "challenge") {
      const parsed = web3WalletAddressSchema.safeParse(
        interaction.options.getString("address", true)
      );

      if (!parsed.success) {
        await interaction.reply({ content: "錢包地址格式不正確。", ephemeral: true });
        return;
      }

      const address = getAddress(parsed.data);
      const expiresAt = new Date(Date.now() + 10 * 60_000);
      const challenge = buildChallenge({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        address,
        nonce: randomBytes(24).toString("hex"),
        expiresAt
      });

      await context.prisma.web3Wallet.upsert({
        where: {
          guildId_userId: {
            guildId: interaction.guildId,
            userId: interaction.user.id
          }
        },
        create: {
          guildId: interaction.guildId,
          userId: interaction.user.id,
          address,
          challenge,
          challengeExpiresAt: expiresAt
        },
        update: {
          address,
          challenge,
          challengeExpiresAt: expiresAt,
          verifiedAt: null
        }
      });

      await interaction.reply({
        content: `請在錢包中簽署以下純文字內容，10 分鐘內使用 \`/wallet verify\` 提交簽章：\n\`\`\`\n${challenge}\n\`\`\``,
        ephemeral: true
      });
      return;
    }

    const wallet = await context.prisma.web3Wallet.findUnique({
      where: {
        guildId_userId: {
          guildId: interaction.guildId,
          userId: interaction.user.id
        }
      },
      include: {
        verifications: true
      }
    });

    if (subcommand === "unlink") {
      if (wallet) {
        const settings = web3SettingsSchema.parse(moduleConfig.settings ?? {});
        const member = interaction.guild
          ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
          : null;

        if (member) {
          const roleIds = [
            ...new Set(settings.collections.map((collection) => collection.roleId))
          ];

          for (const roleId of roleIds) {
            if (member.roles.cache.has(roleId)) {
              await member.roles.remove(roleId, "Hydrava wallet unlinked").catch(() => null);
            }
          }
        }

        await context.prisma.web3Wallet.delete({ where: { id: wallet.id } });
      }
      await interaction.reply({ content: "已解除錢包連結。", ephemeral: true });
      return;
    }

    if (subcommand === "status") {
      await interaction.reply({
        content: wallet
          ? [
              `錢包：\`${wallet.address}\``,
              `簽章：${wallet.verifiedAt ? "已驗證" : "尚未驗證"}`,
              ...wallet.verifications.map(
                (verification) =>
                  `• ${verification.collectionKey}：${verification.eligible ? "符合" : "不符合"}（餘額 ${verification.balance}）`
              )
            ].join("\n")
          : "尚未連結錢包，請先使用 `/wallet challenge`。",
        ephemeral: true
      });
      return;
    }

    if (!wallet || wallet.challengeExpiresAt <= new Date()) {
      await interaction.reply({
        content: "找不到有效的簽章挑戰，請重新使用 `/wallet challenge`。",
        ephemeral: true
      });
      return;
    }

    const signature = web3WalletSignatureSchema.safeParse(
      interaction.options.getString("signature", true)
    );

    if (!signature.success) {
      await interaction.reply({ content: "簽章格式不正確。", ephemeral: true });
      return;
    }

    let recoveredAddress: string;

    try {
      recoveredAddress = getAddress(verifyMessage(wallet.challenge, signature.data));
    } catch {
      await interaction.reply({ content: "無法驗證這份錢包簽章。", ephemeral: true });
      return;
    }

    if (recoveredAddress !== getAddress(wallet.address)) {
      await interaction.reply({ content: "簽章與這個錢包地址不符。", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    await context.prisma.web3Wallet.update({
      where: { id: wallet.id },
      data: {
        verifiedAt: new Date()
      }
    });
    const results = await verifyWalletHoldings(
      interaction.guildId,
      interaction.user.id,
      context
    );
    await interaction.editReply({
      content:
        results.length > 0
          ? `錢包驗證完成，已檢查 ${results.length} 個收藏條件。`
          : "錢包簽章驗證完成；目前沒有可檢查的收藏或 RPC 尚未設定。"
    });
  }
};

export const web3Commands = [walletCommand] satisfies BotCommand[];
