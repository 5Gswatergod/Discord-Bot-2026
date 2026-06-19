import { EmbedBuilder, type Role } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";

export async function handleRoleCreate(role: Role, context: CommandContext) {
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("身分組已建立")
    .addFields({
      name: "身分組",
      value: `<@&${role.id}> (${role.name})`
    });

  await sendGuildLog(context, role.guild, LogEvent.ROLE_CREATE, embed, {
    targetType: "Role",
    targetId: role.id
  });
}
