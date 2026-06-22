import {
  EmbedBuilder,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialMessage,
  type PartialUser,
  type User
} from "discord.js";

import { starboardSettingsSchema } from "@guildforge/shared";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { getGuildModuleSettings } from "../modules";

function matchesEmoji(
  reaction: MessageReaction | PartialMessageReaction,
  configuredEmoji: string
) {
  return [reaction.emoji.id, reaction.emoji.name, reaction.emoji.toString()]
    .filter(Boolean)
    .includes(configuredEmoji);
}

async function fetchReaction(reaction: MessageReaction | PartialMessageReaction) {
  return reaction.partial ? reaction.fetch().catch(() => null) : reaction;
}

async function fetchMessage(reaction: MessageReaction) {
  const message = reaction.message;
  return message.partial ? message.fetch().catch(() => null) : message;
}

function buildStarboardEmbed(message: Message<true>) {
  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL()
    })
    .setDescription(message.content || "（無文字內容）")
    .addFields({
      name: "原始訊息",
      value: `[前往訊息](${message.url})`
    })
    .setTimestamp(message.createdAt);
  const image = message.attachments.find((attachment) =>
    attachment.contentType?.startsWith("image/")
  );

  if (image) {
    embed.setImage(image.url);
  }

  return embed;
}

export async function handleStarboardReaction(
  rawReaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  context: CommandContext
) {
  if (user.bot) {
    return;
  }

  const reaction = await fetchReaction(rawReaction);

  if (!reaction) {
    return;
  }

  const message = await fetchMessage(reaction);

  if (!message?.inGuild() || message.author.bot) {
    return;
  }

  const config = await getGuildModuleSettings(context.prisma, message.guildId, "STARBOARD");

  if (!config.enabled) {
    return;
  }

  const settings = starboardSettingsSchema.parse(config.settings ?? {});

  if (
    !settings.channelId ||
    settings.ignoredChannelIds.includes(message.channelId) ||
    !matchesEmoji(reaction, settings.emoji)
  ) {
    return;
  }

  const users = await reaction.users.fetch().catch(() => null);

  if (!users) {
    return;
  }

  const starCount = users.filter(
    (reactor) =>
      !reactor.bot && (settings.allowSelfStar || reactor.id !== message.author.id)
  ).size;
  const existing = await context.prisma.starboardEntry.findUnique({
    where: {
      guildId_sourceMessageId: {
        guildId: message.guildId,
        sourceMessageId: message.id
      }
    }
  });

  if (starCount < settings.threshold) {
    if (!existing) {
      return;
    }

    if (settings.removeBelowThreshold) {
      const starboardChannel = await message.guild.channels
        .fetch(existing.starboardChannelId)
        .catch(() => null);

      if (isSendableGuildTextChannel(starboardChannel) && existing.starboardMessageId) {
        const starboardMessage = await starboardChannel.messages
          .fetch(existing.starboardMessageId)
          .catch(() => null);
        await starboardMessage?.delete().catch(() => null);
      }

      await context.prisma.starboardEntry.delete({
        where: { id: existing.id }
      });
    } else {
      await context.prisma.starboardEntry.update({
        where: { id: existing.id },
        data: { starCount }
      });
    }

    return;
  }

  const starboardChannel = await message.guild.channels.fetch(settings.channelId).catch(() => null);

  if (!isSendableGuildTextChannel(starboardChannel)) {
    return;
  }

  const payload = {
    content: `${settings.emoji} **${starCount}** · <#${message.channelId}>`,
    embeds: [buildStarboardEmbed(message)]
  };
  const starboardMessage =
    existing?.starboardMessageId && existing.starboardChannelId === starboardChannel.id
      ? await starboardChannel.messages.fetch(existing.starboardMessageId).catch(() => null)
      : null;

  if (
    existing?.starboardMessageId &&
    existing.starboardChannelId !== starboardChannel.id
  ) {
    const previousChannel = await message.guild.channels
      .fetch(existing.starboardChannelId)
      .catch(() => null);

    if (isSendableGuildTextChannel(previousChannel)) {
      const previousMessage = await previousChannel.messages
        .fetch(existing.starboardMessageId)
        .catch(() => null);
      await previousMessage?.delete().catch(() => null);
    }
  }

  const publishedMessage = starboardMessage
    ? await starboardMessage.edit(payload)
    : await starboardChannel.send(payload);

  await context.prisma.starboardEntry.upsert({
    where: {
      guildId_sourceMessageId: {
        guildId: message.guildId,
        sourceMessageId: message.id
      }
    },
    create: {
      guildId: message.guildId,
      sourceChannelId: message.channelId,
      sourceMessageId: message.id,
      starboardChannelId: starboardChannel.id,
      starboardMessageId: publishedMessage.id,
      authorUserId: message.author.id,
      starCount
    },
    update: {
      sourceChannelId: message.channelId,
      starboardChannelId: starboardChannel.id,
      starboardMessageId: publishedMessage.id,
      starCount
    }
  });
}

export async function handleStarboardSourceDelete(
  message: Message<boolean> | PartialMessage,
  context: CommandContext
) {
  if (!message.guild) {
    return;
  }

  const entry = await context.prisma.starboardEntry.findUnique({
    where: {
      guildId_sourceMessageId: {
        guildId: message.guild.id,
        sourceMessageId: message.id
      }
    }
  });

  if (!entry) {
    return;
  }

  const channel = await message.guild.channels.fetch(entry.starboardChannelId).catch(() => null);

  if (isSendableGuildTextChannel(channel) && entry.starboardMessageId) {
    const starboardMessage = await channel.messages.fetch(entry.starboardMessageId).catch(() => null);
    await starboardMessage?.delete().catch(() => null);
  }

  await context.prisma.starboardEntry.delete({
    where: { id: entry.id }
  });
}
