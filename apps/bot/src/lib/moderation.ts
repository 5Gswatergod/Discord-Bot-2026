import {
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild
} from "discord.js";

import { ModerationAction, type DatabaseClient } from "@guildforge/database";
import { moderationSettingsSchema, type ModerationSettings } from "@guildforge/shared";

import type { CommandContext } from "../commands/types";
import { getGuildModuleSettings, isGuildModuleEnabled } from "./modules";

const moderationActionLabels: Record<string, string> = {
  BAN: "封鎖",
  KICK: "踢除",
  TIMEOUT: "禁言",
  WARN: "警告",
  CLEAR: "清除訊息",
  MUTE: "靜音",
  UNMUTE: "解除靜音",
  SLOWMODE: "慢速模式",
  LOCK: "鎖定頻道",
  UNLOCK: "解鎖頻道",
  AUTOMOD_DELETE_MESSAGE: "自動管理：刪除訊息",
  AUTOMOD_WARN: "自動管理：警告",
  AUTOMOD_TIMEOUT: "自動管理：禁言",
  AUTOMOD_KICK: "自動管理：踢除",
  AUTOMOD_BAN: "自動管理：封鎖"
};

export async function getModerationSettings(prisma: DatabaseClient, guildId: string) {
  const config = await getGuildModuleSettings(prisma, guildId, "MODERATION");

  return {
    enabled: config.enabled,
    settings: moderationSettingsSchema.parse(config.settings ?? {})
  };
}

export async function requireModerationModule(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "此指令只能在伺服器內使用。",
      ephemeral: true
    });
    return false;
  }

  return true;
}

export async function ensureModerationReady(
  interaction: ChatInputCommandInteraction,
  context: CommandContext
) {
  if (!(await requireModerationModule(interaction)) || !interaction.guildId) {
    return null;
  }

  const moderation = await getModerationSettings(context.prisma, interaction.guildId);

  if (!moderation.enabled) {
    await interaction.reply({
      content: "此伺服器已停用管理功能。",
      ephemeral: true
    });
    return null;
  }

  if (!hasModeratorAccess(interaction, moderation.settings)) {
    await interaction.reply({
      content: "你沒有使用管理指令的權限。",
      ephemeral: true
    });
    return null;
  }

  return moderation.settings;
}

export function hasModeratorAccess(
  interaction: ChatInputCommandInteraction,
  settings: ModerationSettings
) {
  const permissions = interaction.memberPermissions;

  if (
    permissions?.any([
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageChannels
    ])
  ) {
    return true;
  }

  if (settings.moderatorRoleIds.length === 0) {
    return false;
  }

  const roles = interaction.member?.roles;

  if (!roles) {
    return false;
  }

  if (Array.isArray(roles)) {
    return roles.some((roleId) => settings.moderatorRoleIds.includes(roleId));
  }

  if (typeof roles === "object" && "cache" in roles) {
    return roles.cache.some((role) => settings.moderatorRoleIds.includes(role.id));
  }

  return false;
}

export async function createModerationCase(
  prisma: DatabaseClient,
  input: {
    guildId: string;
    action: ModerationAction;
    targetUserId: string;
    moderatorUserId: string;
    reason?: string | null;
    durationSeconds?: number | null;
    expiresAt?: Date | null;
  }
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.moderationCase.aggregate({
      where: {
        guildId: input.guildId
      },
      _max: {
        caseNumber: true
      }
    });
    const caseNumber = (current._max.caseNumber ?? 0) + 1;

    return tx.moderationCase.create({
      data: {
        guildId: input.guildId,
        caseNumber,
        action: input.action,
        targetUserId: input.targetUserId,
        moderatorUserId: input.moderatorUserId,
        reason: input.reason,
        durationSeconds: input.durationSeconds,
        expiresAt: input.expiresAt
      }
    });
  });
}

export async function createWarning(
  prisma: DatabaseClient,
  input: {
    guildId: string;
    caseId: string;
    targetUserId: string;
    moderatorUserId: string;
    reason: string;
  }
) {
  return prisma.warning.create({
    data: input
  });
}

export async function sendModerationActionLog(
  context: CommandContext,
  guild: Guild,
  input: {
    action: string;
    caseNumber: number;
    targetUserId: string;
    moderatorUserId: string;
    reason?: string | null;
    channelId?: string | null;
  }
) {
  const moderation = await getModerationSettings(context.prisma, guild.id);
  const logChannelId = input.channelId ?? moderation.settings.logChannelId;

  await context.prisma.auditLog.create({
    data: {
      guildId: guild.id,
      actorUserId: input.moderatorUserId,
      action: `MODERATION_${input.action}`,
      targetType: "User",
      targetId: input.targetUserId,
      metadata: {
        caseNumber: input.caseNumber,
        reason: input.reason
      }
    }
  });

  if (!logChannelId) {
    return;
  }

  const channel = await guild.channels.fetch(logChannelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle(`管理案件 #${input.caseNumber}`)
    .addFields(
      {
        name: "操作",
        value: moderationActionLabels[input.action] ?? input.action,
        inline: true
      },
      {
        name: "對象",
        value: `<@${input.targetUserId}>`,
        inline: true
      },
      {
        name: "管理員",
        value: `<@${input.moderatorUserId}>`,
        inline: true
      },
      {
        name: "理由",
        value: input.reason || "未提供理由。"
      }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch((error) => {
    context.logger.warn("Failed to send moderation log", {
      guildId: guild.id,
      channelId: logChannelId,
      error
    });
  });
}

export async function getModerationLogChannelId(prisma: DatabaseClient, guildId: string) {
  const moderation = await getModerationSettings(prisma, guildId);

  if (moderation.settings.logChannelId) {
    return moderation.settings.logChannelId;
  }

  if (!(await isGuildModuleEnabled(prisma, guildId, "LOGGING"))) {
    return null;
  }

  const config = await prisma.logConfig.findUnique({
    where: {
      guildId_event: {
        guildId,
        event: "MODERATION_ACTION"
      }
    }
  });

  return config?.enabled ? config.channelId : null;
}
