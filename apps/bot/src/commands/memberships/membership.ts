import {
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";

import {
  MembershipEntitlementStatus
} from "@guildforge/database";
import { membershipSettingsSchema } from "@guildforge/shared";

import type { BotCommand } from "../types";
import { getGuildModuleSettings } from "../../lib/modules";
import { syncGuildMemberships } from "../../lib/memberships/memberships";

const membershipCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("membership")
    .setDescription("管理 Hydrava 會員權益。")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("grant")
        .setDescription("授予會員方案。")
        .addUserOption((option) =>
          option.setName("member").setDescription("Discord 成員").setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("plan").setDescription("Dashboard 設定的方案代碼").setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("days")
            .setDescription("有效天數；省略代表不自動到期")
            .setMinValue(1)
            .setMaxValue(3_650)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("revoke")
        .setDescription("撤銷會員方案。")
        .addUserOption((option) =>
          option.setName("member").setDescription("Discord 成員").setRequired(true)
        )
        .addStringOption((option) =>
          option.setName("plan").setDescription("Dashboard 設定的方案代碼").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("查看成員的會員權益。")
        .addUserOption((option) =>
          option.setName("member").setDescription("Discord 成員").setRequired(true)
        )
    ),
  async execute(interaction, context) {
    if (!interaction.guildId) {
      return;
    }

    const config = await getGuildModuleSettings(
      context.prisma,
      interaction.guildId,
      "MEMBERSHIPS"
    );

    if (!config.enabled) {
      await interaction.reply({ content: "此伺服器尚未啟用付費會員模組。", ephemeral: true });
      return;
    }

    const settings = membershipSettingsSchema.parse(config.settings ?? {});
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser("member", true);

    if (subcommand === "status") {
      const entitlements = await context.prisma.membershipEntitlement.findMany({
        where: {
          guildId: interaction.guildId,
          userId: user.id
        },
        orderBy: {
          createdAt: "asc"
        }
      });
      const planMap = new Map(settings.plans.map((plan) => [plan.key, plan.name]));

      await interaction.reply({
        content:
          entitlements.length > 0
            ? entitlements
                .map(
                  (item) =>
                    `• ${planMap.get(item.planKey) ?? item.planKey}：${item.status}${
                      item.expiresAt ? `，到期 ${item.expiresAt.toLocaleString("zh-TW")}` : ""
                    }`
                )
                .join("\n")
            : "此成員目前沒有會員權益。",
        ephemeral: true
      });
      return;
    }

    const planKey = interaction.options.getString("plan", true);
    const plan = settings.plans.find((item) => item.key === planKey && item.enabled);

    if (!plan) {
      await interaction.reply({
        content: "找不到這個會員方案代碼，請先到 Dashboard 確認。",
        ephemeral: true
      });
      return;
    }

    if (subcommand === "grant") {
      const days = interaction.options.getInteger("days");
      const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1_000) : null;

      await context.prisma.membershipEntitlement.upsert({
        where: {
          guildId_userId_planKey: {
            guildId: interaction.guildId,
            userId: user.id,
            planKey
          }
        },
        create: {
          guildId: interaction.guildId,
          userId: user.id,
          planKey,
          status: MembershipEntitlementStatus.ACTIVE,
          source: "MANUAL",
          expiresAt,
          lastEventAt: new Date()
        },
        update: {
          status: MembershipEntitlementStatus.ACTIVE,
          source: "MANUAL",
          expiresAt,
          lastEventAt: new Date(),
          lastSyncedAt: new Date(),
          lastError: null
        }
      });
    } else {
      await context.prisma.membershipEntitlement.upsert({
        where: {
          guildId_userId_planKey: {
            guildId: interaction.guildId,
            userId: user.id,
            planKey
          }
        },
        create: {
          guildId: interaction.guildId,
          userId: user.id,
          planKey,
          status: MembershipEntitlementStatus.CANCELED,
          source: "MANUAL",
          expiresAt: new Date(),
          lastEventAt: new Date()
        },
        update: {
          status: MembershipEntitlementStatus.CANCELED,
          source: "MANUAL",
          expiresAt: new Date(),
          lastEventAt: new Date(),
          lastSyncedAt: new Date()
        }
      });
    }

    await context.prisma.auditLog.create({
      data: {
        guildId: interaction.guildId,
        actorUserId: interaction.user.id,
        action: subcommand === "grant" ? "MEMBERSHIP_MANUAL_GRANT" : "MEMBERSHIP_MANUAL_REVOKE",
        targetType: "User",
        targetId: user.id,
        metadata: {
          planKey
        }
      }
    });

    await syncGuildMemberships(interaction.guildId, context);
    await interaction.reply({
      content: subcommand === "grant" ? `已授予 ${plan.name}。` : `已撤銷 ${plan.name}。`,
      ephemeral: true
    });
  }
};

export const membershipCommands = [membershipCommand] satisfies BotCommand[];
