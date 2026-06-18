import { EmbedBuilder, type GuildMember, type PartialGuildMember } from "discord.js";

import { formatTemplate } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { isGuildModuleEnabled } from "../modules";

function renderMemberTemplate(
  template: string,
  member: GuildMember | PartialGuildMember,
  memberCount?: number
) {
  return formatTemplate(template, {
    user: `<@${member.id}>`,
    username: member.user?.username ?? "Unknown",
    server: member.guild.name,
    memberCount: memberCount ?? member.guild.memberCount
  });
}

async function sendConfiguredMessage(
  context: CommandContext,
  member: GuildMember | PartialGuildMember,
  input: {
    channelId: string | null;
    message: string;
    useEmbed: boolean;
    embedColor: string;
    title: string;
  }
) {
  if (!input.channelId) {
    return;
  }

  const channel = await member.guild.channels.fetch(input.channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  const content = renderMemberTemplate(input.message, member);

  if (input.useEmbed) {
    const color = Number.parseInt(input.embedColor.replace("#", ""), 16);
    const embed = new EmbedBuilder()
      .setTitle(input.title)
      .setDescription(content)
      .setColor(Number.isNaN(color) ? 0x24b47e : color)
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch((error) => {
      context.logger.warn("Failed to send welcome module embed", {
        guildId: member.guild.id,
        channelId: input.channelId,
        error
      });
    });
    return;
  }

  await channel.send({ content }).catch((error) => {
    context.logger.warn("Failed to send welcome module message", {
      guildId: member.guild.id,
      channelId: input.channelId,
      error
    });
  });
}

export async function handleWelcomeMemberAdd(member: GuildMember, context: CommandContext) {
  const moduleEnabled = await isGuildModuleEnabled(context.prisma, member.guild.id, "WELCOME");

  if (!moduleEnabled) {
    return;
  }

  const config = await context.prisma.welcomeConfig.findUnique({
    where: {
      guildId: member.guild.id
    }
  });

  if (!config?.enabled) {
    return;
  }

  if (config.autoRoleId) {
    await member.roles.add(config.autoRoleId, "GuildForge welcome auto role").catch((error) => {
      context.logger.warn("Failed to assign welcome auto role", {
        guildId: member.guild.id,
        userId: member.id,
        roleId: config.autoRoleId,
        error
      });
    });
  }

  await sendConfiguredMessage(context, member, {
    channelId: config.welcomeChannelId,
    message: config.welcomeMessage,
    useEmbed: config.useEmbed,
    embedColor: config.embedColor,
    title: "Welcome"
  });
}

export async function handleWelcomeMemberRemove(
  member: GuildMember | PartialGuildMember,
  context: CommandContext
) {
  const moduleEnabled = await isGuildModuleEnabled(context.prisma, member.guild.id, "WELCOME");

  if (!moduleEnabled) {
    return;
  }

  const config = await context.prisma.welcomeConfig.findUnique({
    where: {
      guildId: member.guild.id
    }
  });

  if (!config?.enabled) {
    return;
  }

  await sendConfiguredMessage(context, member, {
    channelId: config.goodbyeChannelId,
    message: config.goodbyeMessage,
    useEmbed: config.useEmbed,
    embedColor: config.embedColor,
    title: "Goodbye"
  });
}
