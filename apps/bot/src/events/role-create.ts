import { EmbedBuilder, type Role } from "discord.js";

import { LogEvent } from "@guildforge/database";

import type { CommandContext } from "../commands/types";
import { sendGuildLog } from "../lib/logging/send-log";

export async function handleRoleCreate(role: Role, context: CommandContext) {
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("Role created")
    .addFields({
      name: "Role",
      value: `<@&${role.id}> (${role.name})`
    });

  await sendGuildLog(context, role.guild, LogEvent.ROLE_CREATE, embed, {
    targetType: "Role",
    targetId: role.id
  });
}
