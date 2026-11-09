import type { Interaction } from "discord.js";

import type { CommandContext } from "../commands/types";
import { commandMap } from "../commands";
import { handleGiveawayButton } from "../lib/giveaways/giveaways";
import { handlePollButton } from "../lib/polls/polls";
import { handleReactionRoleButton } from "../lib/reaction-roles/reaction-roles";
import { handleTicketButton } from "../lib/tickets/tickets";
import { MusicUserError } from "../lib/music/music";

export async function handleInteractionCreate(interaction: Interaction, context: CommandContext) {
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("music:search:")) {
    try {
      await context.music?.handleSearchSelection(interaction);
    } catch (error) {
      await handleInteractionError(interaction, error, context);
    }
    return;
  }

  if (interaction.isButton()) {
    try {
      if (await context.music?.handleButton(interaction)) {
        return;
      }
      if (await handleTicketButton(interaction, context)) {
        return;
      }

      if (await handleReactionRoleButton(interaction, context)) {
        return;
      }

      if (await handleGiveawayButton(interaction, context)) {
        return;
      }

      if (await handlePollButton(interaction, context)) {
        return;
      }
    } catch (error) {
      await handleInteractionError(interaction, error, context);
    }

    return;
  }

  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);

    if (!command?.autocomplete) {
      await interaction.respond([]);
      return;
    }

    try {
      await command.autocomplete(interaction, context);
    } catch (error) {
      context.logger.error("Slash command autocomplete failed", {
        command: interaction.commandName,
        guildId: interaction.guildId,
        error
      });
      await interaction.respond([]).catch(() => null);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commandMap.get(interaction.commandName);

  if (!command) {
    await interaction.reply({
      content: "未知的指令。",
      ephemeral: true
    });
    return;
  }

  try {
    await command.execute(interaction, context);
  } catch (error) {
    await handleInteractionError(interaction, error, context);
  }
}

async function handleInteractionError(
  interaction: Extract<Interaction, { reply: unknown; deferred: boolean; replied: boolean }>,
  error: unknown,
  context: CommandContext
) {
  if (!(error instanceof MusicUserError)) {
    context.logger.error("Interaction failed", {
      guildId: interaction.guildId,
      error
    });
  }

  const response = {
    content: error instanceof MusicUserError ? error.message : "執行指令時發生錯誤，請稍後再試。",
    ephemeral: true
  };

  if (interaction.deferred || interaction.replied) {
    if ("editReply" in interaction && interaction.deferred && !interaction.replied) {
      await interaction.editReply({
        content: response.content,
        components: []
      });
      return;
    }

    if ("followUp" in interaction) {
      await interaction.followUp(response);
    }
    return;
  }

  await interaction.reply(response);
}
