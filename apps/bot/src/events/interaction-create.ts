import type { Interaction } from "discord.js";

import type { CommandContext } from "../commands/types";
import { commandMap } from "../commands";
import { handleGiveawayButton } from "../lib/giveaways/giveaways";
import { handlePollButton } from "../lib/polls/polls";
import { handleReactionRoleButton } from "../lib/reaction-roles/reaction-roles";

export async function handleInteractionCreate(interaction: Interaction, context: CommandContext) {
  if (interaction.isButton()) {
    if (await handleReactionRoleButton(interaction, context)) {
      return;
    }

    if (await handleGiveawayButton(interaction, context)) {
      return;
    }

    if (await handlePollButton(interaction, context)) {
      return;
    }

    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commandMap.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: "Unknown command.",
      ephemeral: true
    });
    return;
  }

  try {
    await command.execute(interaction, context);
  } catch (error) {
    context.logger.error("Slash command failed", {
      command: interaction.commandName,
      guildId: interaction.guildId,
      error
    });

    const response = {
      content: "Something went wrong while running this command.",
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response);
      return;
    }

    await interaction.reply(response);
  }
}
