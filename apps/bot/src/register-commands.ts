import { REST, Routes } from "discord.js";

import { commands } from "./commands";
import { env } from "./env";
import { logger } from "./lib/logger";

async function main() {
  const rest = new REST({
    version: "10"
  }).setToken(env.DISCORD_BOT_TOKEN);

  const body = commands.map((command) => command.data.toJSON());
  const route = env.DISCORD_TEST_GUILD_ID
    ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_TEST_GUILD_ID)
    : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

  logger.info("Registering slash commands", {
    scope: env.DISCORD_TEST_GUILD_ID ? "guild" : "global",
    count: body.length
  });

  await rest.put(route, {
    body
  });

  logger.info("Slash commands registered");
}

main().catch((error) => {
  logger.error("Failed to register slash commands", error);
  process.exit(1);
});
