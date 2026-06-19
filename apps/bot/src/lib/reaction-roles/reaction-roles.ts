import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
  type GuildMember,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User
} from "discord.js";

import { ReactionRoleMode, ReactionRoleOptionType } from "@guildforge/database";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { isGuildModuleEnabled } from "../modules";

const buttonPrefix = "rr:";

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

export async function publishReactionRolePanel(
  context: CommandContext,
  guildId: string,
  panelId: string
) {
  const panel = await context.prisma.reactionRolePanel.findFirst({
    where: {
      id: panelId,
      guildId
    },
    include: {
      options: {
        orderBy: {
          sortOrder: "asc"
        }
      }
    }
  });

  if (!panel) {
    return null;
  }

  const guild = await context.prisma.guild.findUnique({
    where: {
      id: guildId
    }
  });

  if (!guild) {
    return null;
  }

  const clientGuild =
    context.client.guilds.cache.get(guildId) ??
    (await context.client.guilds.fetch(guildId).catch(() => null));
  const channel = await clientGuild?.channels.fetch(panel.channelId).catch(() => null);

  if (!isSendableGuildTextChannel(channel)) {
    return null;
  }

  const buttonOptions = panel.options.filter((option) => option.type === ReactionRoleOptionType.BUTTON);
  const reactionOptions = panel.options.filter((option) => option.type === ReactionRoleOptionType.REACTION);
  const embed = new EmbedBuilder()
    .setColor(parseColor(panel.color))
    .setTitle(panel.title)
    .setDescription(panel.description ?? "請在下方選擇身分組。");
  const message = await channel.send({
    embeds: [embed],
    components: buildRows(buttonOptions)
  });

  for (const option of reactionOptions) {
    if (option.emoji) {
      await message.react(option.emoji).catch((error) => {
        context.logger.warn("Failed to add reaction role emoji", {
          guildId,
          panelId,
          optionId: option.id,
          error
        });
      });
    }
  }

  await context.prisma.reactionRolePanel.update({
    where: {
      id: panel.id
    },
    data: {
      messageId: message.id
    }
  });

  return message;
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

  if (!option?.panel.enabled) {
    return "此身分組面板目前無法使用。";
  }

  const moduleEnabled = await isGuildModuleEnabled(context.prisma, member.guild.id, "REACTION_ROLES");

  if (!moduleEnabled) {
    return "此伺服器已停用自助身分組功能。";
  }

  if (option.panel.mode === ReactionRoleMode.SINGLE_SELECT && mode !== "remove") {
    const otherRoleIds = option.panel.options
      .filter((item) => item.id !== option.id)
      .map((item) => item.roleId);
    await member.roles.remove(otherRoleIds).catch(() => null);
  }

  const hasRole = member.roles.cache.has(option.roleId);
  const shouldRemove = mode === "remove" || (mode === "toggle" && hasRole);

  if (shouldRemove) {
    await member.roles.remove(option.roleId, "自助身分組切換");
    return `已移除 ${option.label}。`;
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

  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    await interaction.reply({
      content: "找不到你的伺服器成員資料。",
      ephemeral: true
    });
    return true;
  }

  const message = await applyRoleOption(context, member, interaction.customId.slice(buttonPrefix.length), "toggle");

  await interaction.reply({
    content: message,
    ephemeral: true
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
        enabled: true
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
