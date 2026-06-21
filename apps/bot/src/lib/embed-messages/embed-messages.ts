import { EmbedBuilder } from "discord.js";

import type { EmbedMessage } from "@guildforge/database";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { isGuildModuleEnabled } from "../modules";

function parseColor(color: string) {
  return Number.parseInt(color.replace("#", ""), 16);
}

function buildEmbed(record: EmbedMessage) {
  const embed = new EmbedBuilder().setColor(parseColor(record.color));

  if (record.title) embed.setTitle(record.title);
  if (record.description) embed.setDescription(record.description);
  if (record.url) embed.setURL(record.url);
  if (record.imageUrl) embed.setImage(record.imageUrl);
  if (record.thumbnailUrl) embed.setThumbnail(record.thumbnailUrl);
  if (record.footerText) embed.setFooter({ text: record.footerText });
  if (record.authorName) embed.setAuthor({ name: record.authorName });

  return embed;
}

export async function syncEmbedMessages(context: CommandContext) {
  const records = await context.prisma.embedMessage.findMany({
    where: { enabled: true },
    orderBy: { updatedAt: "asc" }
  });
  const enabledGuilds = new Map<string, boolean>();

  for (const record of records) {
    try {
      if (
        record.messageId &&
        record.publishedAt &&
        record.updatedAt.getTime() <= record.publishedAt.getTime()
      ) {
        continue;
      }

      let moduleEnabled = enabledGuilds.get(record.guildId);

      if (moduleEnabled === undefined) {
        moduleEnabled = await isGuildModuleEnabled(
          context.prisma,
          record.guildId,
          "EMBED_MESSAGES"
        );
        enabledGuilds.set(record.guildId, moduleEnabled);
      }

      if (!moduleEnabled) {
        continue;
      }

      const guild = context.client.guilds.cache.get(record.guildId);
      const channel = guild ? await guild.channels.fetch(record.channelId).catch(() => null) : null;

      if (!isSendableGuildTextChannel(channel)) {
        continue;
      }

      const payload = {
        content: record.content ?? undefined,
        embeds: [buildEmbed(record)]
      };
      const existing = record.messageId
        ? await channel.messages.fetch(record.messageId).catch(() => null)
        : null;
      const message = existing ? await existing.edit(payload) : await channel.send(payload);

      await context.prisma.embedMessage.update({
        where: { id: record.id },
        data: {
          messageId: message.id,
          publishedAt: new Date()
        }
      });
    } catch (error) {
      context.logger.warn("Failed to synchronize embed message", {
        embedMessageId: record.id,
        error
      });
    }
  }
}
