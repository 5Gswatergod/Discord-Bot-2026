import type { GuildMember, PartialGuildMember } from "discord.js";

import type { CommandContext } from "../commands/types";
import { handleAutomationRoleUpdate } from "../lib/automations/automations";

export async function handleGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
  context: CommandContext
) {
  await handleAutomationRoleUpdate(oldMember, newMember, context).catch((error) => {
    context.logger.warn("Failed to process member role automation", {
      guildId: newMember.guild.id,
      userId: newMember.id,
      error
    });
  });
}
