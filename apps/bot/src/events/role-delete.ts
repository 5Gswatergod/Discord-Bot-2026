import { EmbedBuilder, type Role } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";

export async function handleRoleDelete(role: Role, context: CommandContext) {
  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("Role deleted")
    .addFields({
      name: "Role",
      value: role.name
    });

  await sendGuildLog(context, role.guild, LogEvent.ROLE_DELETE, embed, {
    targetType: "Role",
    targetId: role.id
  });
}
