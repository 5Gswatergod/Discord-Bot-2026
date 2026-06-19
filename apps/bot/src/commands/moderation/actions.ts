import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type GuildTextBasedChannel
} from "discord.js";

import { ModerationAction } from "@guildforge/database";

import type { BotCommand, CommandContext } from "../types";
import {
  createModerationCase,
  createWarning,
  ensureModerationReady,
  sendModerationActionLog
} from "../../lib/moderation";
import { parseDurationToSeconds } from "../../lib/time";

const noReason = "未提供理由。";

async function fetchTargetMember(interaction: ChatInputCommandInteraction, optionName = "user") {
  const user = interaction.options.getUser(optionName, true);
  const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

  return {
    user,
    member: member ?? null
  };
}

async function ensureBotPermission(
  interaction: ChatInputCommandInteraction,
  permission: bigint,
  label: string
) {
  const botMember = interaction.guild?.members.me;

  if (!botMember?.permissions.has(permission)) {
    await interaction.reply({
      content: `機器人需要「${label}」權限才能執行此操作。`,
      ephemeral: true
    });
    return false;
  }

  return true;
}

async function ensureActionTarget(
  interaction: ChatInputCommandInteraction,
  member: GuildMember | null,
  action: "ban" | "kick" | "timeout" | "mute" | "warn"
) {
  if (!member) {
    if (action === "ban") {
      return true;
    }

    await interaction.reply({
      content: "該使用者目前不是此伺服器的成員。",
      ephemeral: true
    });
    return false;
  }

  if (member.id === interaction.user.id) {
    await interaction.reply({
      content: "你不能對自己使用此指令。",
      ephemeral: true
    });
    return false;
  }

  if (member.id === interaction.client.user.id) {
    await interaction.reply({
      content: "機器人不能對自己執行此操作。",
      ephemeral: true
    });
    return false;
  }

  const guild = interaction.guild;
  const actor = await guild?.members.fetch(interaction.user.id).catch(() => null);

  if (!guild || !actor) {
    await interaction.reply({
      content: "無法確認你的伺服器身分組資料。",
      ephemeral: true
    });
    return false;
  }

  if (member.id === guild.ownerId) {
    await interaction.reply({
      content: "不能對伺服器擁有者執行此操作。",
      ephemeral: true
    });
    return false;
  }

  if (
    actor.id !== guild.ownerId &&
    actor.roles.highest.comparePositionTo(member.roles.highest) <= 0
  ) {
    await interaction.reply({
      content: "你不能對身分組與你同級或高於你的成員執行此操作。",
      ephemeral: true
    });
    return false;
  }

  if (action === "ban" && !member.bannable) {
    await interaction.reply({
      content: "無法封鎖該成員，請檢查身分組階級與機器人權限。",
      ephemeral: true
    });
    return false;
  }

  if (action === "kick" && !member.kickable) {
    await interaction.reply({
      content: "無法踢除該成員，請檢查身分組階級與機器人權限。",
      ephemeral: true
    });
    return false;
  }

  if (action === "timeout" && !member.moderatable) {
    await interaction.reply({
      content: "無法禁言該成員，請檢查身分組階級與機器人權限。",
      ephemeral: true
    });
    return false;
  }

  return true;
}

async function ensureManageableRole(
  interaction: ChatInputCommandInteraction,
  roleId: string
) {
  const guild = interaction.guild;
  const actor = await guild?.members.fetch(interaction.user.id).catch(() => null);
  const role = await guild?.roles.fetch(roleId).catch(() => null);

  if (!guild || !actor || !role) {
    await interaction.reply({
      content: "找不到設定的靜音身分組。",
      ephemeral: true
    });
    return false;
  }

  if (!role.editable) {
    await interaction.reply({
      content: "機器人的身分組階級不足，無法管理設定的靜音身分組。",
      ephemeral: true
    });
    return false;
  }

  if (actor.id !== guild.ownerId && actor.roles.highest.comparePositionTo(role) <= 0) {
    await interaction.reply({
      content: "你的身分組階級不足，無法管理設定的靜音身分組。",
      ephemeral: true
    });
    return false;
  }

  return true;
}

async function recordAndReply(
  interaction: ChatInputCommandInteraction,
  context: CommandContext,
  input: {
    action: ModerationAction;
    targetUserId: string;
    reason?: string | null;
    durationSeconds?: number | null;
    expiresAt?: Date | null;
    publicMessage: string;
  }
) {
  if (!interaction.guildId || !interaction.guild) {
    return;
  }

  const moderationCase = await createModerationCase(context.prisma, {
    guildId: interaction.guildId,
    action: input.action,
    targetUserId: input.targetUserId,
    moderatorUserId: interaction.user.id,
    reason: input.reason,
    durationSeconds: input.durationSeconds,
    expiresAt: input.expiresAt
  });

  await sendModerationActionLog(context, interaction.guild, {
    action: input.action,
    caseNumber: moderationCase.caseNumber,
    targetUserId: input.targetUserId,
    moderatorUserId: interaction.user.id,
    reason: input.reason
  });

  await interaction.reply({
    content: `${input.publicMessage} 案件編號 #${moderationCase.caseNumber}。`,
    ephemeral: true
  });

  return moderationCase;
}

export const banCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setNameLocalizations({ "zh-TW": "封鎖" })
    .setDescription("從此伺服器封鎖使用者。")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "使用者" })
        .setDescription("要封鎖的使用者。")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({ "zh-TW": "理由" })
        .setDescription("封鎖理由。")
        .setMaxLength(512)
    )
    .addIntegerOption((option) =>
      option
        .setName("delete_message_seconds")
        .setNameLocalizations({ "zh-TW": "刪除訊息秒數" })
        .setDescription("刪除近期訊息紀錄，最多 604800 秒。")
        .setMinValue(0)
        .setMaxValue(604_800)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.BanMembers,
      permissionLabel: "封鎖成員"
    });

    if (!settings || !(await ensureBotPermission(interaction, PermissionFlagsBits.BanMembers, "封鎖成員"))) {
      return;
    }

    const { user, member } = await fetchTargetMember(interaction);

    if (!(await ensureActionTarget(interaction, member, "ban"))) {
      return;
    }

    const reason = interaction.options.getString("reason") ?? noReason;
    const deleteMessageSeconds = interaction.options.getInteger("delete_message_seconds") ?? 0;

    await interaction.guild?.members.ban(user.id, {
      reason,
      deleteMessageSeconds
    });

    await recordAndReply(interaction, context, {
      action: ModerationAction.BAN,
      targetUserId: user.id,
      reason,
      publicMessage: `已封鎖 ${user.tag}。`
    });
  }
};

export const kickCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setNameLocalizations({ "zh-TW": "踢除" })
    .setDescription("將成員踢出此伺服器。")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "使用者" })
        .setDescription("要踢除的成員。")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({ "zh-TW": "理由" })
        .setDescription("踢除理由。")
        .setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.KickMembers,
      permissionLabel: "踢除成員"
    });

    if (!settings || !(await ensureBotPermission(interaction, PermissionFlagsBits.KickMembers, "踢除成員"))) {
      return;
    }

    const { user, member } = await fetchTargetMember(interaction);

    if (!(await ensureActionTarget(interaction, member, "kick")) || !member) {
      return;
    }

    const reason = interaction.options.getString("reason") ?? noReason;
    await member.kick(reason);

    await recordAndReply(interaction, context, {
      action: ModerationAction.KICK,
      targetUserId: user.id,
      reason,
      publicMessage: `已踢除 ${user.tag}。`
    });
  }
};

export const timeoutCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setNameLocalizations({ "zh-TW": "禁言" })
    .setDescription("暫時禁言成員。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "使用者" })
        .setDescription("要禁言的成員。")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setNameLocalizations({ "zh-TW": "持續時間" })
        .setDescription("禁言時間，例如 10m、2h 或 1d。")
        .setRequired(true)
        .setMaxLength(8)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({ "zh-TW": "理由" })
        .setDescription("禁言理由。")
        .setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.ModerateMembers,
      permissionLabel: "禁言成員"
    });

    if (
      !settings ||
      !(await ensureBotPermission(interaction, PermissionFlagsBits.ModerateMembers, "禁言成員"))
    ) {
      return;
    }

    const { user, member } = await fetchTargetMember(interaction);

    if (!(await ensureActionTarget(interaction, member, "timeout")) || !member) {
      return;
    }

    const duration = interaction.options.getString("duration", true);
    const durationSeconds = parseDurationToSeconds(duration);

    if (!durationSeconds || durationSeconds > 2_419_200) {
      await interaction.reply({
        content: "持續時間格式必須像 10m、2h 或 1d，最長 28 天。",
        ephemeral: true
      });
      return;
    }

    const reason = interaction.options.getString("reason") ?? noReason;
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);
    await member.timeout(durationSeconds * 1000, reason);

    await recordAndReply(interaction, context, {
      action: ModerationAction.TIMEOUT,
      targetUserId: user.id,
      reason,
      durationSeconds,
      expiresAt,
      publicMessage: `已將 ${user.tag} 禁言 ${duration}。`
    });
  }
};

export const warnCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setNameLocalizations({ "zh-TW": "警告" })
    .setDescription("警告成員。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "使用者" })
        .setDescription("要警告的成員。")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({ "zh-TW": "理由" })
        .setDescription("警告理由。")
        .setRequired(true)
        .setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.ModerateMembers,
      permissionLabel: "禁言成員",
      allowConfiguredModeratorRole: true
    });

    if (!settings || !interaction.guildId || !interaction.guild) {
      return;
    }

    const { user, member } = await fetchTargetMember(interaction);

    if (!(await ensureActionTarget(interaction, member, "warn")) || !member) {
      return;
    }

    const reason = interaction.options.getString("reason", true);
    const moderationCase = await recordAndReply(interaction, context, {
      action: ModerationAction.WARN,
      targetUserId: user.id,
      reason,
      publicMessage: `已警告 ${user.tag}。`
    });

    if (moderationCase) {
      await createWarning(context.prisma, {
        guildId: interaction.guildId,
        caseId: moderationCase.id,
        targetUserId: user.id,
        moderatorUserId: interaction.user.id,
        reason
      });
    }
  }
};

export const warningsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setNameLocalizations({ "zh-TW": "警告紀錄" })
    .setDescription("顯示成員的警告紀錄。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "使用者" })
        .setDescription("要查看的成員。")
        .setRequired(true)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.ModerateMembers,
      permissionLabel: "禁言成員",
      allowConfiguredModeratorRole: true
    });

    if (!settings || !interaction.guildId) {
      return;
    }

    const user = interaction.options.getUser("user", true);
    const warnings = await context.prisma.warning.findMany({
      where: {
        guildId: interaction.guildId,
        targetUserId: user.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    });

    if (warnings.length === 0) {
      await interaction.reply({
        content: `${user.tag} 沒有任何警告紀錄。`,
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: warnings
        .map(
          (warning, index) =>
            `${index + 1}. ${warning.reason} - <t:${Math.floor(warning.createdAt.getTime() / 1000)}:R>`
        )
        .join("\n"),
      ephemeral: true
    });
  }
};

export const clearCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setNameLocalizations({ "zh-TW": "清除訊息" })
    .setDescription("批次刪除近期訊息。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setNameLocalizations({ "zh-TW": "數量" })
        .setDescription("要刪除的訊息數量。")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "使用者" })
        .setDescription("只刪除此使用者傳送的訊息。")
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.ManageMessages,
      permissionLabel: "管理訊息"
    });

    if (
      !settings ||
      !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageMessages, "管理訊息"))
    ) {
      return;
    }

    const channel = interaction.channel as GuildTextBasedChannel | null;

    if (!channel || !("bulkDelete" in channel)) {
      await interaction.reply({
        content: "此頻道不支援批次刪除訊息。",
        ephemeral: true
      });
      return;
    }

    const amount = interaction.options.getInteger("amount", true);
    const user = interaction.options.getUser("user");
    let deletedCount = 0;

    if (user) {
      const messages = await channel.messages.fetch({ limit: Math.min(amount * 2, 100) });
      const userMessages = messages.filter((message) => message.author.id === user.id).first(amount);
      const deleted = await channel.bulkDelete(userMessages, true);
      deletedCount = deleted.size;
    } else {
      const deleted = await channel.bulkDelete(amount, true);
      deletedCount = deleted.size;
    }

    await recordAndReply(interaction, context, {
      action: ModerationAction.CLEAR,
      targetUserId: user?.id ?? interaction.user.id,
      reason: `已在 #${channel.name} 刪除 ${deletedCount} 則訊息。`,
      publicMessage: `已刪除 ${deletedCount} 則訊息。`
    });
  }
};

export const muteCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setNameLocalizations({ "zh-TW": "靜音" })
    .setDescription("將設定的靜音身分組指派給成員。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "使用者" })
        .setDescription("要靜音的成員。")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({ "zh-TW": "理由" })
        .setDescription("靜音理由。")
        .setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.ManageRoles,
      permissionLabel: "管理身分組"
    });

    if (!settings || !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageRoles, "管理身分組"))) {
      return;
    }

    if (!settings.muteRoleId) {
      await interaction.reply({
        content: "此伺服器尚未設定靜音身分組。",
        ephemeral: true
      });
      return;
    }

    if (!(await ensureManageableRole(interaction, settings.muteRoleId))) {
      return;
    }

    const { user, member } = await fetchTargetMember(interaction);

    if (!(await ensureActionTarget(interaction, member, "mute")) || !member) {
      return;
    }

    const reason = interaction.options.getString("reason") ?? noReason;
    await member.roles.add(settings.muteRoleId, reason);

    await recordAndReply(interaction, context, {
      action: ModerationAction.MUTE,
      targetUserId: user.id,
      reason,
      publicMessage: `已將 ${user.tag} 靜音。`
    });
  }
};

export const unmuteCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setNameLocalizations({ "zh-TW": "解除靜音" })
    .setDescription("移除成員的靜音身分組。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({ "zh-TW": "使用者" })
        .setDescription("要解除靜音的成員。")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({ "zh-TW": "理由" })
        .setDescription("解除靜音的理由。")
        .setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.ManageRoles,
      permissionLabel: "管理身分組"
    });

    if (!settings || !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageRoles, "管理身分組"))) {
      return;
    }

    if (!settings.muteRoleId) {
      await interaction.reply({
        content: "此伺服器尚未設定靜音身分組。",
        ephemeral: true
      });
      return;
    }

    if (!(await ensureManageableRole(interaction, settings.muteRoleId))) {
      return;
    }

    const { user, member } = await fetchTargetMember(interaction);

    if (!(await ensureActionTarget(interaction, member, "mute")) || !member) {
      return;
    }

    const reason = interaction.options.getString("reason") ?? noReason;
    await member.roles.remove(settings.muteRoleId, reason);

    await recordAndReply(interaction, context, {
      action: ModerationAction.UNMUTE,
      targetUserId: user.id,
      reason,
      publicMessage: `已解除 ${user.tag} 的靜音。`
    });
  }
};

export const slowmodeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setNameLocalizations({ "zh-TW": "慢速模式" })
    .setDescription("設定文字頻道的慢速模式。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName("seconds")
        .setNameLocalizations({ "zh-TW": "秒數" })
        .setDescription("慢速模式間隔秒數，輸入 0 可停用。")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21_600)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setNameLocalizations({ "zh-TW": "頻道" })
        .setDescription("要更新的頻道。")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.ManageChannels,
      permissionLabel: "管理頻道"
    });

    if (
      !settings ||
      !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageChannels, "管理頻道"))
    ) {
      return;
    }

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    const seconds = interaction.options.getInteger("seconds", true);

    if (!channel || !("setRateLimitPerUser" in channel)) {
      await interaction.reply({
        content: "該頻道不支援慢速模式。",
        ephemeral: true
      });
      return;
    }

    await channel.setRateLimitPerUser(seconds, `由 ${interaction.user.tag} 設定慢速模式`);

    await recordAndReply(interaction, context, {
      action: ModerationAction.SLOWMODE,
      targetUserId: interaction.user.id,
      reason: `已將 #${channel.name} 的慢速模式設為 ${seconds} 秒。`,
      publicMessage: `已將 #${channel.name} 的慢速模式設為 ${seconds} 秒。`
    });
  }
};

export const lockCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setNameLocalizations({ "zh-TW": "鎖定頻道" })
    .setDescription("禁止 @everyone 在頻道中傳送訊息。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setNameLocalizations({ "zh-TW": "頻道" })
        .setDescription("要鎖定的頻道。")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({ "zh-TW": "理由" })
        .setDescription("鎖定理由。")
        .setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.ManageChannels,
      permissionLabel: "管理頻道"
    });

    if (
      !settings ||
      !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageChannels, "管理頻道"))
    ) {
      return;
    }

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;

    if (!interaction.guild || !channel || !("permissionOverwrites" in channel)) {
      await interaction.reply({
        content: "無法鎖定該頻道。",
        ephemeral: true
      });
      return;
    }

    const reason = interaction.options.getString("reason") ?? noReason;
    await channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      {
        SendMessages: false
      },
      {
        reason
      }
    );

    await recordAndReply(interaction, context, {
      action: ModerationAction.LOCK,
      targetUserId: interaction.user.id,
      reason,
      publicMessage: `已鎖定 #${channel.name}。`
    });
  }
};

export const unlockCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setNameLocalizations({ "zh-TW": "解鎖頻道" })
    .setDescription("恢復 @everyone 在頻道中傳送訊息的權限。")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setNameLocalizations({ "zh-TW": "頻道" })
        .setDescription("要解鎖的頻道。")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setNameLocalizations({ "zh-TW": "理由" })
        .setDescription("解鎖理由。")
        .setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context, {
      permission: PermissionFlagsBits.ManageChannels,
      permissionLabel: "管理頻道"
    });

    if (
      !settings ||
      !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageChannels, "管理頻道"))
    ) {
      return;
    }

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;

    if (!interaction.guild || !channel || !("permissionOverwrites" in channel)) {
      await interaction.reply({
        content: "無法解鎖該頻道。",
        ephemeral: true
      });
      return;
    }

    const reason = interaction.options.getString("reason") ?? noReason;
    await channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      {
        SendMessages: null
      },
      {
        reason
      }
    );

    await recordAndReply(interaction, context, {
      action: ModerationAction.UNLOCK,
      targetUserId: interaction.user.id,
      reason,
      publicMessage: `已解鎖 #${channel.name}。`
    });
  }
};

export const moderationCommands = [
  banCommand,
  kickCommand,
  timeoutCommand,
  warnCommand,
  warningsCommand,
  clearCommand,
  muteCommand,
  unmuteCommand,
  slowmodeCommand,
  lockCommand,
  unlockCommand
] satisfies BotCommand[];
