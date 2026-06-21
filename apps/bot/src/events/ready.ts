import { ActivityType, type Client } from "discord.js";

import type { CommandContext } from "../commands/types";
import { ensureGuildDefaults } from "../lib/guild-config";
import { refreshGuildInviteSnapshot } from "../lib/invite-tracking/invite-tracking";

export async function handleReady(client: Client<true>, context: CommandContext) {
  client.user.setPresence({
    activities: [
      {
        name: "伺服器管理工具",
        type: ActivityType.Watching
      }
    ],
    status: "online"
  });

  for (const guild of client.guilds.cache.values()) {
    await ensureGuildDefaults(context.prisma, guild);
    await refreshGuildInviteSnapshot(guild, context);
  }

  context.logger.info("Bot is ready", {
    tag: client.user.tag,
    guilds: client.guilds.cache.size
  });
}
