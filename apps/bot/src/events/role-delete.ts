import { EmbedBuilder, type Role } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";

export async function handleRoleDelete(role: Role, context: CommandContext) {
  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("身分組已刪除")
    .addFields({
      name: "身分組",
      value: role.name
    });

  await sendGuildLog(context, role.guild, LogEvent.ROLE_DELETE, embed, {
    targetType: "Role",
    targetId: role.id
  });
}
