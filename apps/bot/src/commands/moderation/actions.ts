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

const noReason = "No reason provided.";

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
      content: `I need the ${label} permission to do that.`,
      ephemeral: true
    });
    return false;
  }

  return true;
}

async function ensureActionTarget(
  interaction: ChatInputCommandInteraction,
  member: GuildMember | null,
  action: "ban" | "kick" | "timeout" | "mute"
) {
  if (!member) {
    if (action === "ban") {
      return true;
    }

    await interaction.reply({
      content: "That user is not a current server member.",
      ephemeral: true
    });
    return false;
  }

  if (member.id === interaction.user.id) {
    await interaction.reply({
      content: "You cannot target yourself with this command.",
      ephemeral: true
    });
    return false;
  }

  if (member.id === interaction.client.user.id) {
    await interaction.reply({
      content: "I cannot target myself.",
      ephemeral: true
    });
    return false;
  }

  if (action === "ban" && !member.bannable) {
    await interaction.reply({
      content: "I cannot ban that member. Check role hierarchy and bot permissions.",
      ephemeral: true
    });
    return false;
  }

  if (action === "kick" && !member.kickable) {
    await interaction.reply({
      content: "I cannot kick that member. Check role hierarchy and bot permissions.",
      ephemeral: true
    });
    return false;
  }

  if (action === "timeout" && !member.moderatable) {
    await interaction.reply({
      content: "I cannot timeout that member. Check role hierarchy and bot permissions.",
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
    content: `${input.publicMessage} Case #${moderationCase.caseNumber}.`,
    ephemeral: true
  });

  return moderationCase;
}

export const banCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from this server.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName("user").setDescription("User to ban.").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for this ban.").setMaxLength(512)
    )
    .addIntegerOption((option) =>
      option
        .setName("delete_message_seconds")
        .setDescription("Delete recent message history, up to 604800 seconds.")
        .setMinValue(0)
        .setMaxValue(604_800)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

    if (!settings || !(await ensureBotPermission(interaction, PermissionFlagsBits.BanMembers, "Ban Members"))) {
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
      publicMessage: `Banned ${user.tag}.`
    });
  }
};

export const kickCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from this server.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName("user").setDescription("Member to kick.").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for this kick.").setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

    if (!settings || !(await ensureBotPermission(interaction, PermissionFlagsBits.KickMembers, "Kick Members"))) {
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
      publicMessage: `Kicked ${user.tag}.`
    });
  }
};

export const timeoutCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName("user").setDescription("Member to timeout.").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription("Duration such as 10m, 2h, or 1d.")
        .setRequired(true)
        .setMaxLength(8)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for this timeout.").setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

    if (
      !settings ||
      !(await ensureBotPermission(interaction, PermissionFlagsBits.ModerateMembers, "Moderate Members"))
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
        content: "Duration must look like 10m, 2h, or 1d, up to 28 days.",
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
      publicMessage: `Timed out ${user.tag} for ${duration}.`
    });
  }
};

export const warnCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName("user").setDescription("Member to warn.").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for this warning.")
        .setRequired(true)
        .setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

    if (!settings || !interaction.guildId || !interaction.guild) {
      return;
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);
    const moderationCase = await recordAndReply(interaction, context, {
      action: ModerationAction.WARN,
      targetUserId: user.id,
      reason,
      publicMessage: `Warned ${user.tag}.`
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
    .setDescription("Show warnings for a member.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName("user").setDescription("Member to inspect.").setRequired(true)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

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
        content: `${user.tag} has no warnings.`,
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
    .setDescription("Bulk delete recent messages.")
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete.")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption((option) =>
      option.setName("user").setDescription("Only delete messages by this user.")
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

    if (
      !settings ||
      !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageMessages, "Manage Messages"))
    ) {
      return;
    }

    const channel = interaction.channel as GuildTextBasedChannel | null;

    if (!channel || !("bulkDelete" in channel)) {
      await interaction.reply({
        content: "This channel does not support bulk deletion.",
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
      reason: `Deleted ${deletedCount} messages in #${channel.name}.`,
      publicMessage: `Deleted ${deletedCount} messages.`
    });
  }
};

export const muteCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Assign the configured mute role to a member.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName("user").setDescription("Member to mute.").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for this mute.").setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

    if (!settings || !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageRoles, "Manage Roles"))) {
      return;
    }

    if (!settings.muteRoleId) {
      await interaction.reply({
        content: "No mute role is configured for this server.",
        ephemeral: true
      });
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
      publicMessage: `Muted ${user.tag}.`
    });
  }
};

export const unmuteCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove the configured mute role from a member.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName("user").setDescription("Member to unmute.").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for this unmute.").setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

    if (!settings || !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageRoles, "Manage Roles"))) {
      return;
    }

    if (!settings.muteRoleId) {
      await interaction.reply({
        content: "No mute role is configured for this server.",
        ephemeral: true
      });
      return;
    }

    const { user, member } = await fetchTargetMember(interaction);

    if (!member) {
      await interaction.reply({
        content: "That user is not a current server member.",
        ephemeral: true
      });
      return;
    }

    const reason = interaction.options.getString("reason") ?? noReason;
    await member.roles.remove(settings.muteRoleId, reason);

    await recordAndReply(interaction, context, {
      action: ModerationAction.UNMUTE,
      targetUserId: user.id,
      reason,
      publicMessage: `Unmuted ${user.tag}.`
    });
  }
};

export const slowmodeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode for a text channel.")
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName("seconds")
        .setDescription("Slowmode delay in seconds. Use 0 to disable.")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21_600)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to update.")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

    if (
      !settings ||
      !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageChannels, "Manage Channels"))
    ) {
      return;
    }

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    const seconds = interaction.options.getInteger("seconds", true);

    if (!channel || !("setRateLimitPerUser" in channel)) {
      await interaction.reply({
        content: "That channel does not support slowmode.",
        ephemeral: true
      });
      return;
    }

    await channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);

    await recordAndReply(interaction, context, {
      action: ModerationAction.SLOWMODE,
      targetUserId: interaction.user.id,
      reason: `Set slowmode to ${seconds}s in #${channel.name}.`,
      publicMessage: `Set slowmode to ${seconds}s in #${channel.name}.`
    });
  }
};

export const lockCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Prevent @everyone from sending messages in a channel.")
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to lock.")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for this lock.").setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

    if (
      !settings ||
      !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageChannels, "Manage Channels"))
    ) {
      return;
    }

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;

    if (!interaction.guild || !channel || !("permissionOverwrites" in channel)) {
      await interaction.reply({
        content: "That channel cannot be locked.",
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
      publicMessage: `Locked #${channel.name}.`
    });
  }
};

export const unlockCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Restore @everyone message sending in a channel.")
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to unlock.")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Reason for this unlock.").setMaxLength(512)
    ),
  async execute(interaction, context) {
    const settings = await ensureModerationReady(interaction, context);

    if (
      !settings ||
      !(await ensureBotPermission(interaction, PermissionFlagsBits.ManageChannels, "Manage Channels"))
    ) {
      return;
    }

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;

    if (!interaction.guild || !channel || !("permissionOverwrites" in channel)) {
      await interaction.reply({
        content: "That channel cannot be unlocked.",
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
      publicMessage: `Unlocked #${channel.name}.`
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
