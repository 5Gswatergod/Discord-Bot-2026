import { EmbedBuilder, type Message, type PartialMessage } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";
import { handleStarboardSourceDelete } from "../lib/starboard/starboard";

export async function handleMessageDelete(
  message: Message<boolean> | PartialMessage,
  context: CommandContext
) {
  if (!message.guild || message.author?.bot) {
    return;
  }

  await handleStarboardSourceDelete(message, context).catch((error) => {
    context.logger.warn("Failed to clean up deleted starboard source", {
      guildId: message.guild?.id,
      messageId: message.id,
      error
    });
  });

  const content = message.content || "無法取得訊息內容。";
  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle("訊息已刪除")
    .addFields(
      {
        name: "頻道",
        value: `<#${message.channelId}>`,
        inline: true
      },
      {
        name: "作者",
        value: message.author ? `<@${message.author.id}>` : "未知使用者",
        inline: true
      },
      {
        name: "內容",
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
