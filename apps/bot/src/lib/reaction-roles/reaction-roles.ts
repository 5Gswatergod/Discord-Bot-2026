import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User
} from "discord.js";

import {
  ReactionRoleMode,
  ReactionRoleOptionType,
  type ReactionRoleOption,
  type ReactionRolePanel
} from "@guildforge/database";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { isGuildModuleEnabled } from "../modules";

const buttonPrefix = "rr:";
const syncingGuildIds = new Set<string>();

type PanelWithOptions = ReactionRolePanel & {
  options: ReactionRoleOption[];
};

export type ReactionRoleSyncSummary = {
  guilds: number;
  checked: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  failed: number;
};

function parseColor(color: string) {
  const parsed = Number.parseInt(color.replace("#", ""), 16);
  return Number.isNaN(parsed) ? 0x24b47e : parsed;
}

function buildRows(options: Array<{ id: string; label: string; emoji: string | null }>) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (let index = 0; index < options.length; index += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    const chunk = options.slice(index, index + 5);

    for (const option of chunk) {
      const button = new ButtonBuilder()
        .setCustomId(`${buttonPrefix}${option.id}`)
        .setLabel(option.label)
        .setStyle(ButtonStyle.Secondary);

      if (option.emoji) {
        button.setEmoji(option.emoji);
      }

      row.addComponents(button);
    }

    rows.push(row);
  }

  return rows;
}

function buildPanelPayload(panel: PanelWithOptions) {
  const buttonOptions = panel.options.filter(
    (option) => option.type === ReactionRoleOptionType.BUTTON
  );

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(parseColor(panel.color))
        .setTitle(panel.title)
        .setDescription(panel.description ?? "請在下方選擇身分組。")
    ],
    components: buildRows(buttonOptions)
  };
}

export function buildReactionRoleSignature(panel: PanelWithOptions) {
  return JSON.stringify(
    panel.options
      .filter((option) => option.type === ReactionRoleOptionType.REACTION)
      .map((option) => ({
        id: option.id,
        emoji: option.emoji ?? ""
      }))
  );
}

async function getGuild(context: CommandContext, guildId: string) {
  return (
    context.client.guilds.cache.get(guildId) ??
    (await context.client.guilds.fetch(guildId).catch(() => null))
  );
}

function isUnknownDiscordResource(error: unknown) {
  const code = (error as { code?: number } | null)?.code;
  return code === 10003 || code === 10008;
}

async function fetchPublishedMessage(
  guild: Guild,
  panel: PanelWithOptions
): Promise<Message<true> | null> {
  if (!panel.messageId) {
    return null;
  }

  const channelId = panel.publishedChannelId ?? panel.channelId;
  const channel = await guild.channels.fetch(channelId).catch((error) => {
    if (isUnknownDiscordResource(error)) {
      return null;
    }

    throw error;
  });

  if (!isSendableGuildTextChannel(channel)) {
    return null;
  }

  return channel.messages.fetch(panel.messageId).catch((error) => {
    if (isUnknownDiscordResource(error)) {
      return null;
    }

    throw error;
  });
}

async function deletePublishedMessage(guild: Guild, panel: PanelWithOptions) {
  if (!panel.messageId) {
    return;
  }

  const message = await fetchPublishedMessage(guild, panel);

  if (message) {
    await message.delete();
  }
}

async function createPanelMessage(
  guild: Guild,
  panel: PanelWithOptions
) {
  const channel = await guild.channels.fetch(panel.channelId).catch((error) => {
    if (isUnknownDiscordResource(error)) {
      return null;
    }

    throw error;
  });

  if (!isSendableGuildTextChannel(channel)) {
    throw new Error("發布頻道已刪除、無法存取或不是可發送訊息的頻道");
  }

  const message = await channel.send(buildPanelPayload(panel));
  const reactionOptions = panel.options.filter(
    (option) => option.type === ReactionRoleOptionType.REACTION
  );

  try {
    for (const option of reactionOptions) {
      if (!option.emoji) {
        throw new Error(`反應選項「${option.label}」缺少 Emoji`);
      }

      await message.react(option.emoji);
    }
  } catch (error) {
    await message.delete().catch(() => null);
    throw error;
  }

  return message;
}

async function markSyncError(
  panelId: string,
  error: unknown,
  context: CommandContext,
  clearPublishedMessage = false
) {
  await context.prisma.reactionRolePanel.update({
    where: { id: panelId },
    data: {
      lastSyncError:
        error instanceof Error ? error.message.slice(0, 1_000) : "未知的 Discord 同步錯誤",
      ...(clearPublishedMessage
        ? {
            messageId: null,
            publishedChannelId: null,
            publishedReactionSignature: null
          }
        : {})
    }
  });
}

async function syncPanel(
  guild: Guild,
  panel: PanelWithOptions,
  moduleEnabled: boolean,
  context: CommandContext
) {
  if (panel.deletedAt || !panel.enabled || !moduleEnabled) {
    try {
      await deletePublishedMessage(guild, panel);

      if (panel.deletedAt) {
        await context.prisma.reactionRolePanel.delete({
          where: { id: panel.id }
        });
        return "deleted" as const;
      }

      await context.prisma.reactionRolePanel.update({
        where: { id: panel.id },
        data: {
          messageId: null,
          publishedChannelId: null,
          publishedReactionSignature: null,
          lastSyncedAt: new Date(),
          lastSyncError: null
        }
      });
      return panel.messageId ? ("deleted" as const) : ("skipped" as const);
    } catch (error) {
      await markSyncError(panel.id, error, context);
      context.logger.warn("Failed to remove reaction role panel message", {
        guildId: panel.guildId,
        panelId: panel.id,
        error
      });
      return "failed" as const;
    }
  }

  const reactionSignature = buildReactionRoleSignature(panel);
  const channelChanged =
    Boolean(panel.messageId) &&
    Boolean(panel.publishedChannelId) &&
    panel.publishedChannelId !== panel.channelId;
  const reactionConfigurationChanged =
    Boolean(panel.messageId) &&
    panel.publishedReactionSignature !== reactionSignature &&
    !(
      panel.publishedReactionSignature === null &&
      reactionSignature === "[]"
    );
  let oldMessageDeleted = false;

  try {
    let message = await fetchPublishedMessage(guild, panel);

    if (message && (channelChanged || reactionConfigurationChanged)) {
      await message.delete();
      oldMessageDeleted = true;
      message = null;
    }

    if (!message) {
      const created = await createPanelMessage(guild, panel);
      await context.prisma.reactionRolePanel.update({
        where: { id: panel.id },
        data: {
          messageId: created.id,
          publishedChannelId: created.channelId,
          publishedReactionSignature: reactionSignature,
          lastSyncedAt: new Date(),
          lastSyncError: null
        }
      });
      return "created" as const;
    }

    if (
      panel.lastSyncedAt &&
      !panel.lastSyncError &&
      !channelChanged &&
      !reactionConfigurationChanged
    ) {
      return "skipped" as const;
    }

    await message.edit(buildPanelPayload(panel));
    await context.prisma.reactionRolePanel.update({
      where: { id: panel.id },
      data: {
        publishedChannelId: message.channelId,
        publishedReactionSignature: reactionSignature,
        lastSyncedAt: new Date(),
        lastSyncError: null
      }
    });
    return "updated" as const;
  } catch (error) {
    await markSyncError(panel.id, error, context, oldMessageDeleted);
    context.logger.warn("Failed to synchronize reaction role panel", {
      guildId: panel.guildId,
      panelId: panel.id,
      error
    });
    return "failed" as const;
  }
}

async function syncReactionRoleGuild(
  context: CommandContext,
  guildId: string
): Promise<ReactionRoleSyncSummary> {
  const summary: ReactionRoleSyncSummary = {
    guilds: 1,
    checked: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    failed: 0
  };

  if (syncingGuildIds.has(guildId)) {
    summary.skipped += 1;
    return summary;
  }

  syncingGuildIds.add(guildId);

  try {
    const panels = await context.prisma.reactionRolePanel.findMany({
      where: { guildId },
      include: {
        options: {
          orderBy: {
            sortOrder: "asc"
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (panels.length === 0) {
      return summary;
    }

    const guild = await getGuild(context, guildId);

    if (!guild) {
      summary.checked = panels.length;
      summary.failed = panels.length;

      for (const panel of panels) {
        await markSyncError(panel.id, new Error("Hydrava 目前無法存取這個伺服器"), context);
      }

      return summary;
    }

    const moduleEnabled = await isGuildModuleEnabled(
      context.prisma,
      guildId,
      "REACTION_ROLES"
    );

    for (const panel of panels) {
      summary.checked += 1;
      const result = await syncPanel(guild, panel, moduleEnabled, context);
      summary[result] += 1;
    }

    return summary;
  } finally {
    syncingGuildIds.delete(guildId);
  }
}

export async function syncReactionRolePanels(
  context: CommandContext,
  guildId?: string
): Promise<ReactionRoleSyncSummary> {
  if (guildId) {
    return syncReactionRoleGuild(context, guildId);
  }

  const guildRows = await context.prisma.reactionRolePanel.findMany({
    distinct: ["guildId"],
    select: {
      guildId: true
    }
  });
  const summary: ReactionRoleSyncSummary = {
    guilds: 0,
    checked: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    failed: 0
  };

  for (const row of guildRows) {
    const guildSummary = await syncReactionRoleGuild(context, row.guildId);

    for (const key of Object.keys(summary) as Array<keyof ReactionRoleSyncSummary>) {
      summary[key] += guildSummary[key];
    }
  }

  return summary;
}

async function applyRoleOption(
  context: CommandContext,
  member: GuildMember,
  optionId: string,
  mode: "toggle" | "add" | "remove"
) {
  const option = await context.prisma.reactionRoleOption.findUnique({
    where: {
      id: optionId
    },
    include: {
      panel: {
        include: {
          options: true
        }
      }
    }
  });

  if (
    !option?.panel.enabled ||
    option.panel.deletedAt ||
    option.guildId !== member.guild.id ||
    option.panel.guildId !== member.guild.id
  ) {
    return "此身分組面板目前無法使用。";
  }

  const moduleEnabled = await isGuildModuleEnabled(
    context.prisma,
    member.guild.id,
    "REACTION_ROLES"
  );

  if (!moduleEnabled) {
    return "此伺服器已停用自助身分組功能。";
  }

  const botMember = await member.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return "機器人缺少「管理身分組」權限，請聯絡管理員。";
  }

  await member.guild.roles.fetch();
  const role = member.guild.roles.cache.get(option.roleId);

  if (!role || role.id === member.guild.id || !role.editable) {
    return "此身分組已刪除或無法指派，請管理員確認它不是整合管理的身分組，且位於機器人的最高身分組下方。";
  }

  const hasRole = member.roles.cache.has(option.roleId);
  const shouldRemove = mode === "remove" || (mode === "toggle" && hasRole);

  if (shouldRemove) {
    await member.roles.remove(option.roleId, "自助身分組切換");
    return `已移除 ${option.label}。`;
  }

  if (option.panel.mode === ReactionRoleMode.SINGLE_SELECT) {
    const otherRoleIds = option.panel.options
      .filter((item) => item.id !== option.id && member.roles.cache.has(item.roleId))
      .map((item) => item.roleId);

    if (otherRoleIds.some((roleId) => !member.guild.roles.cache.get(roleId)?.editable)) {
      return "無法移除目前的單選身分組，請管理員檢查身分組層級與權限。";
    }

    if (otherRoleIds.length > 0) {
      await member.roles.remove(otherRoleIds, "自助身分組單選切換");
    }
  }

  await member.roles.add(option.roleId, "自助身分組切換");
  return `已新增 ${option.label}。`;
}

export async function handleReactionRoleButton(
  interaction: ButtonInteraction,
  context: CommandContext
) {
  if (!interaction.customId.startsWith(buttonPrefix) || !interaction.inGuild()) {
    return false;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = await interaction.guild?.members.fetch({
    user: interaction.user.id,
    force: true
  });

  if (!member) {
    await interaction.editReply({
      content: "找不到你的伺服器成員資料。"
    });
    return true;
  }

  const message = await applyRoleOption(
    context,
    member,
    interaction.customId.slice(buttonPrefix.length),
    "toggle"
  );

  await interaction.editReply({
    content: message
  });
  return true;
}

async function resolveReactionOption(
  context: CommandContext,
  reaction: MessageReaction | PartialMessageReaction
) {
  const fullReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;

  if (!fullReaction?.message.guildId) {
    return null;
  }

  return context.prisma.reactionRoleOption.findFirst({
    where: {
      guildId: fullReaction.message.guildId,
      type: ReactionRoleOptionType.REACTION,
      emoji: fullReaction.emoji.id ?? fullReaction.emoji.name,
      panel: {
        messageId: fullReaction.message.id,
        enabled: true,
        deletedAt: null
      }
    },
    include: {
      panel: true
    }
  });
}

export async function handleReactionRoleReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  context: CommandContext,
  mode: "add" | "remove"
) {
  if (user.bot) {
    return;
  }

  const option = await resolveReactionOption(context, reaction);

  if (!option) {
    return;
  }

  const guild = reaction.message.guild;

  if (!guild) {
    return;
  }

  const member = await guild.members.fetch(user.id).catch(() => null);

  if (!member) {
    return;
  }

  await applyRoleOption(context, member, option.id, mode).catch((error) => {
    context.logger.warn("Failed to apply reaction role reaction", {
      guildId: guild.id,
      optionId: option.id,
      userId: user.id,
      error
    });
  });
}
