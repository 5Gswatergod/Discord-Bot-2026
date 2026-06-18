import { EmbedBuilder, type Message, type PartialMessage } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";

export async function handleMessageDelete(
  message: Message<boolean> | PartialMessage,
  context: CommandContext
) {
  if (!message.guild || message.author?.bot) {
    return;
  }

  const content = message.content || "Content unavailable.";
  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle("Message deleted")
    .addFields(
      {
        name: "Channel",
        value: `<#${message.channelId}>`,
        inline: true
      },
      {
        name: "Author",
        value: message.author ? `<@${message.author.id}>` : "Unknown",
        inline: true
      },
      {
        name: "Content",
        value: content.slice(0, 1_000)
      }
    );

  await sendGuildLog(context, message.guild, LogEvent.MESSAGE_DELETE, embed, {
    targetType: "Message",
    targetId: message.id,
    channelId: message.channelId,
    authorId: message.author?.id
  });
}
