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

  const before = oldMessage.content || "無法取得訊息內容。";
  const after = newMessage.content || "無法取得訊息內容。";

  if (before === after) {
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle("訊息已編輯")
    .addFields(
      {
        name: "頻道",
        value: `<#${newMessage.channelId}>`,
        inline: true
      },
      {
        name: "作者",
        value: newMessage.author ? `<@${newMessage.author.id}>` : "未知使用者",
        inline: true
      },
      {
        name: "編輯前",
        value: before.slice(0, 700)
      },
      {
        name: "編輯後",
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
