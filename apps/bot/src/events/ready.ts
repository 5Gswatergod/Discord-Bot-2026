import { ActivityType, type Client } from "discord.js";

import type { CommandContext } from "../commands/types";
import { ensureGuildDefaults } from "../lib/guild-config";

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
  }

  context.logger.info("Bot is ready", {
    tag: client.user.tag,
    guilds: client.guilds.cache.size
  });
}
