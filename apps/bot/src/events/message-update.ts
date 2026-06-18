import { EmbedBuilder, type Message, type PartialMessage } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";

export async function handleMessageUpdate(
  oldMessage: Message<boolean> | PartialMessage,
  newMessage: Message<boolean> | PartialMessage,
  context: CommandContext
) {
  if (!newMessage.guild || newMessage.author?.bot) {
    return;
  }

  const before = oldMessage.content || "Content unavailable.";
  const after = newMessage.content || "Content unavailable.";

  if (before === after) {
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle("Message edited")
    .addFields(
      {
        name: "Channel",
        value: `<#${newMessage.channelId}>`,
        inline: true
      },
      {
        name: "Author",
        value: newMessage.author ? `<@${newMessage.author.id}>` : "Unknown",
        inline: true
      },
      {
        name: "Before",
        value: before.slice(0, 700)
      },
      {
        name: "After",
        value: after.slice(0, 700)
      }
    );

  await sendGuildLog(context, newMessage.guild, LogEvent.MESSAGE_UPDATE, embed, {
    targetType: "Message",
    targetId: newMessage.id,
    channelId: newMessage.channelId,
    authorId: newMessage.author?.id
  });
}
