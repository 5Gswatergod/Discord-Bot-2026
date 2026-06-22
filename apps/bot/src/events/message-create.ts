import type { Message } from "discord.js";

import type { CommandContext } from "../commands/types";
import { handleAutoModMessage } from "../lib/automod/automod";
import { handleCustomCommandMessage } from "../lib/custom-commands/custom-commands";
import { handleEconomyMessage } from "../lib/economy/economy";
import { handleLevelingMessage } from "../lib/leveling/leveling";
import { recordMessageActivity } from "../lib/achievements/achievements";

export async function handleMessageCreate(message: Message, context: CommandContext) {
  if (!message.inGuild() || message.author.bot) {
    return;
  }

  const punished = await handleAutoModMessage(message, context);

  if (punished) {
    return;
  }

  const customCommandHandled = await handleCustomCommandMessage(message, context);

  if (!customCommandHandled) {
    await handleLevelingMessage(message, context);
    await handleEconomyMessage(message, context);
  }

  await recordMessageActivity(context, message.guildId, message.author.id).catch((error) => {
    context.logger.warn("Failed to record achievement activity", {
      guildId: message.guildId,
      userId: message.author.id,
      error
    });
  });
}
