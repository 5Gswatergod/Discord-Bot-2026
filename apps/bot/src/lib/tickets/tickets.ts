import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
  type GuildMember
} from "discord.js";

import { ModuleKey, TicketStatus } from "@guildforge/database";
import { formatTemplate, ticketSettingsSchema, type TicketSettings } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { getGuildModuleSettings } from "../modules";

const openButtonId = "ticket:open";
const claimButtonPrefix = "ticket:claim:";
const closeButtonPrefix = "ticket:close:";

function buildPanel(settings: TicketSettings) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x2dd4bf)
        .setTitle(settings.panelTitle)
        .setDescription(settings.panelDescription)
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(openButtonId)
          .setLabel("建立客服單")
          .setEmoji("🎫")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  };
}

function buildTicketControls(ticketId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${claimButtonPrefix}${ticketId}`)
      .setLabel("領取")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${closeButtonPrefix}${ticketId}`)
      .setLabel("關閉")
      .setStyle(ButtonStyle.Danger)
  );
}

async function getTicketSettings(context: CommandContext, guildId: string) {
  const config = await getGuildModuleSettings(context.prisma, guildId, "TICKETS");
  return {
    enabled: config.enabled,
    settings: ticketSettingsSchema.parse(config.settings ?? {}),
    rawSettings:
      typeof config.settings === "object" && config.settings !== null
        ? (config.settings as Record<string, unknown>)
        : {}
  };
}

export async function syncTicketPanels(context: CommandContext) {
  const configs = await context.prisma.moduleConfig.findMany({
    where: {
      module: ModuleKey.TICKETS,
      enabled: true
    }
  });

  for (const config of configs) {
    try {
      const parsed = ticketSettingsSchema.parse(config.settings ?? {});

      if (!parsed.panelChannelId) {
        continue;
      }

      const guild = context.client.guilds.cache.get(config.guildId);
      const channel = guild
        ? await guild.channels.fetch(parsed.panelChannelId).catch(() => null)
        : null;

      if (!isSendableGuildTextChannel(channel)) {
        continue;
      }

      const rawSettings =
        typeof config.settings === "object" && config.settings !== null
          ? (config.settings as Record<string, unknown>)
          : {};
      const panelMessageId =
        typeof rawSettings.panelMessageId === "string" ? rawSettings.panelMessageId : null;
      const panelSignature = JSON.stringify({
        channelId: parsed.panelChannelId,
        title: parsed.panelTitle,
        description: parsed.panelDescription
      });
      const existing = panelMessageId
        ? await channel.messages.fetch(panelMessageId).catch(() => null)
        : null;

      if (existing && rawSettings.panelSignature === panelSignature) {
        continue;
      }

      const panel = buildPanel(parsed);
      const message = existing ? await existing.edit(panel) : await channel.send(panel);

      if (
        message.id !== panelMessageId ||
        rawSettings.panelSignature !== panelSignature
      ) {
        await context.prisma.moduleConfig.update({
          where: {
            guildId_module: {
              guildId: config.guildId,
              module: ModuleKey.TICKETS
            }
          },
          data: {
            settings: {
              ...rawSettings,
              ...parsed,
              panelMessageId: message.id,
              panelSignature
            }
          }
        });
      }
    } catch (error) {
      context.logger.warn("Failed to synchronize ticket panel", {
        guildId: config.guildId,
        error
      });
    }
  }
}

function isSupportMember(member: GuildMember, settings: TicketSettings) {
  return (
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    settings.supportRoleIds.some((roleId) => member.roles.cache.has(roleId))
  );
}

async function sendTicketLog(
  context: CommandContext,
  guildId: string,
  settings: TicketSettings,
  title: string,
  fields: Array<{ name: string; value: string; inline?: boolean }>
) {
  if (!settings.logChannelId) {
    return;
  }

  const guild = context.client.guilds.cache.get(guildId);
  const channel = guild
    ? await guild.channels.fetch(settings.logChannelId).catch(() => null)
    : null;

  if (!isSendableGuildTextChannel(channel)) {
    return;
  }

  await channel.send({
    embeds: [new EmbedBuilder().setColor(0x2dd4bf).setTitle(title).addFields(fields).setTimestamp()]
  });
}

async function openTicket(interaction: ButtonInteraction, context: CommandContext) {
  if (!interaction.guild || !interaction.guildId) {
    return;
  }

  const guild = interaction.guild;
  const { enabled, settings, rawSettings } = await getTicketSettings(context, interaction.guildId);

  if (!enabled) {
    await interaction.followUp({ content: "此伺服器已停用客服單功能。", ephemeral: true });
    return;
  }

  const panelMessageId =
    typeof rawSettings.panelMessageId === "string" ? rawSettings.panelMessageId : null;

  if (
    (settings.panelChannelId && interaction.channelId !== settings.panelChannelId) ||
    (panelMessageId && interaction.message.id !== panelMessageId)
  ) {
    await interaction.followUp({
      content: "這是已失效的客服面板，請使用目前設定頻道中的新面板。",
      ephemeral: true
    });
    return;
  }

  const openCount = await context.prisma.ticket.count({
    where: {
      guildId: interaction.guildId,
      ownerUserId: interaction.user.id,
      status: TicketStatus.OPEN
    }
  });

  if (openCount >= settings.maxOpenPerUser) {
    await interaction.followUp({
      content: `你最多只能同時開啟 ${settings.maxOpenPerUser} 張客服單。`,
      ephemeral: true
    });
    return;
  }

  const safeName =
    interaction.user.username
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48) || "member";
  const supportRoleIds = settings.supportRoleIds.filter((roleId) =>
    guild.roles.cache.has(roleId)
  );
  const categoryId =
    settings.categoryId &&
    guild.channels.cache.get(settings.categoryId)?.type === ChannelType.GuildCategory
      ? settings.categoryId
      : undefined;
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    },
    ...supportRoleIds.map((roleId) => ({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    }))
  ];
  const channel = await guild.channels.create({
    name: `ticket-${safeName}-${interaction.user.id.slice(-4)}`,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites,
    reason: `Hydrava ticket opened by ${interaction.user.tag}`
  });

  try {
    const ticket = await context.prisma.ticket.create({
      data: {
        guildId: interaction.guildId,
        channelId: channel.id,
        ownerUserId: interaction.user.id
      }
    });
    const welcome = formatTemplate(settings.ticketWelcomeMessage, {
      user: `<@${interaction.user.id}>`,
      username: interaction.user.username,
      server: guild.name
    });

    await channel.send({
      content: `${welcome}\n${supportRoleIds.map((roleId) => `<@&${roleId}>`).join(" ")}`.trim(),
      components: [buildTicketControls(ticket.id)],
      allowedMentions: {
        users: [interaction.user.id],
        roles: supportRoleIds
      }
    });
    await sendTicketLog(context, interaction.guildId, settings, "客服單已建立", [
      { name: "建立者", value: `<@${interaction.user.id}>`, inline: true },
      { name: "頻道", value: `<#${channel.id}>`, inline: true },
      { name: "客服單 ID", value: ticket.id }
    ]);
    await interaction.followUp({ content: `客服單已建立：${channel}`, ephemeral: true });
  } catch (error) {
    await channel.delete("Ticket database creation failed").catch(() => null);
    throw error;
  }
}

async function claimTicket(
  interaction: ButtonInteraction,
  context: CommandContext,
  ticketId: string
) {
  if (!interaction.guild || !interaction.guildId) {
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const { settings } = await getTicketSettings(context, interaction.guildId);

  if (!isSupportMember(member, settings)) {
    await interaction.followUp({ content: "你不是客服團隊成員。", ephemeral: true });
    return;
  }

  const updated = await context.prisma.ticket.updateMany({
    where: {
      id: ticketId,
      guildId: interaction.guildId,
      status: TicketStatus.OPEN,
      claimedByUserId: null
    },
    data: {
      claimedByUserId: interaction.user.id
    }
  });

  await interaction.followUp({
    content: updated.count > 0 ? `${interaction.user} 已領取此客服單。` : "此客服單已被領取。",
    ephemeral: updated.count === 0
  });

  if (updated.count > 0) {
    await sendTicketLog(context, interaction.guildId, settings, "客服單已領取", [
      { name: "客服", value: `<@${interaction.user.id}>`, inline: true },
      { name: "客服單 ID", value: ticketId }
    ]);
  }
}

export async function closeTicket(
  context: CommandContext,
  guildId: string,
  channelId: string,
  actorUserId: string,
  reason?: string | null
) {
  const ticket = await context.prisma.ticket.findFirst({
    where: {
      guildId,
      channelId,
      status: TicketStatus.OPEN
    }
  });

  if (!ticket) {
    return null;
  }

  const updated = await context.prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: TicketStatus.CLOSED,
      closeReason: reason ?? null,
      closedAt: new Date()
    }
  });

  await context.prisma.auditLog.create({
    data: {
      guildId,
      actorUserId,
      action: "TICKET_CLOSED",
      targetType: "Ticket",
      targetId: ticket.id,
      metadata: {
        ownerUserId: ticket.ownerUserId,
        reason: reason ?? null
      }
    }
  });
  const { settings } = await getTicketSettings(context, guildId);
  await sendTicketLog(context, guildId, settings, "客服單已關閉", [
    { name: "建立者", value: `<@${ticket.ownerUserId}>`, inline: true },
    { name: "關閉者", value: `<@${actorUserId}>`, inline: true },
    { name: "原因", value: reason || "未提供" },
    { name: "客服單 ID", value: ticket.id }
  ]);

  return updated;
}

async function closeTicketFromButton(
  interaction: ButtonInteraction,
  context: CommandContext,
  ticketId: string
) {
  if (!interaction.guild || !interaction.guildId || !interaction.channelId) {
    return;
  }

  const ticket = await context.prisma.ticket.findFirst({
    where: {
      id: ticketId,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      status: TicketStatus.OPEN
    }
  });

  if (!ticket) {
    await interaction.followUp({ content: "找不到仍在處理中的客服單。", ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const { settings } = await getTicketSettings(context, interaction.guildId);

  if (ticket.ownerUserId !== interaction.user.id && !isSupportMember(member, settings)) {
    await interaction.followUp({ content: "你沒有權限關閉此客服單。", ephemeral: true });
    return;
  }

  await closeTicket(
    context,
    interaction.guildId,
    interaction.channelId,
    interaction.user.id,
    "按鈕關閉"
  );
  await interaction.followUp("客服單已關閉，此頻道將在 10 秒後刪除。");

  setTimeout(() => {
    void interaction.channel?.delete("Hydrava ticket closed").catch(() => null);
  }, 10_000);
}

export async function handleTicketButton(interaction: ButtonInteraction, context: CommandContext) {
  if (!interaction.customId.startsWith("ticket:") || !interaction.inGuild()) {
    return false;
  }

  try {
    await interaction.deferUpdate();
    if (interaction.customId === openButtonId) {
      await openTicket(interaction, context);
      return true;
    }

    if (interaction.customId.startsWith(claimButtonPrefix)) {
      await claimTicket(interaction, context, interaction.customId.slice(claimButtonPrefix.length));
      return true;
    }

    if (interaction.customId.startsWith(closeButtonPrefix)) {
      await closeTicketFromButton(
        interaction,
        context,
        interaction.customId.slice(closeButtonPrefix.length)
      );
      return true;
    }
  } catch (error) {
    context.logger.error("Ticket button interaction failed", {
      guildId: interaction.guildId,
      customId: interaction.customId,
      error
    });
    const response = {
      content: "處理客服單時發生錯誤，請稍後再試。",
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(() => null);
    } else {
      await interaction.reply(response).catch(() => null);
    }

    return true;
  }

  return false;
}
