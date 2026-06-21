import type { Guild } from "discord.js";

import type { CommandContext } from "../commands/types";
import { ensureGuildDefaults } from "../lib/guild-config";
import { refreshGuildInviteSnapshot } from "../lib/invite-tracking/invite-tracking";

export async function handleGuildCreate(guild: Guild, context: CommandContext) {
  await ensureGuildDefaults(context.prisma, guild);
  await refreshGuildInviteSnapshot(guild, context);

  await context.prisma.auditLog.create({
    data: {
      guildId: guild.id,
      action: "BOT_JOINED_GUILD",
      targetType: "Guild",
      targetId: guild.id,
      metadata: {
        name: guild.name
      }
    }
  });

  context.logger.info("Joined guild", {
    guildId: guild.id,
    name: guild.name
  });
}
