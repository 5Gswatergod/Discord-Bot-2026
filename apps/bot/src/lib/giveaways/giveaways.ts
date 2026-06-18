import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
  type Guild
} from "discord.js";

import { GiveawayStatus, type Giveaway } from "@guildforge/database";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { isGuildModuleEnabled } from "../modules";

const buttonPrefix = "gw:";

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildGiveawayEmbed(giveaway: Giveaway, entryCount = 0) {
  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("Giveaway")
    .setDescription(giveaway.prize)
    .addFields(
      {
        name: "Winners",
        value: String(giveaway.winnerCount),
        inline: true
      },
      {
        name: "Entries",
        value: String(entryCount),
        inline: true
      },
      {
        name: "Ends",
        value: `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`,
        inline: true
      },
      {
        name: "Giveaway ID",
        value: giveaway.id
      }
    )
    .setTimestamp();
}

function buildGiveawayButton(giveawayId: string, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${buttonPrefix}${giveawayId}`)
      .setLabel("Enter giveaway")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );
}

async function fetchTextChannel(guild: Guild, channelId: string) {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return isSendableGuildTextChannel(channel) ? channel : null;
}

export async function createGiveawayMessage(context: CommandContext, giveaway: Giveaway) {
  const guild = await context.client.guilds.fetch(giveaway.guildId).catch(() => null);
  const channel = guild ? await fetchTextChannel(guild, giveaway.channelId) : null;

  if (!channel) {
    return null;
  }

  const message = await channel.send({
    embeds: [buildGiveawayEmbed(giveaway)],
    components: [buildGiveawayButton(giveaway.id)]
  });

  await context.prisma.giveaway.update({
    where: {
      id: giveaway.id
    },
    data: {
      messageId: message.id
    }
  });

  return message;
}

async function pickWinners(context: CommandContext, giveaway: Giveaway) {
  const entries = await context.prisma.giveawayEntry.findMany({
    where: {
      giveawayId: giveaway.id
    }
  });
  return shuffle(entries.map((entry) => entry.userId)).slice(0, giveaway.winnerCount);
}

export async function endGiveaway(context: CommandContext, giveawayId: string, reroll = false) {
  const giveaway = await context.prisma.giveaway.findUnique({
    where: {
      id: giveawayId
    },
    include: {
      entries: true
    }
  });

  if (!giveaway || (!reroll && giveaway.status === GiveawayStatus.ENDED)) {
    return null;
  }

  const winners = await pickWinners(context, giveaway);
  const updated = await context.prisma.giveaway.update({
    where: {
      id: giveaway.id
    },
    data: {
      status: GiveawayStatus.ENDED,
      winners
    }
  });
  const guild = await context.client.guilds.fetch(giveaway.guildId).catch(() => null);
  const channel = guild ? await fetchTextChannel(guild, giveaway.channelId) : null;

  if (channel) {
    const winnerText =
      winners.length > 0 ? winners.map((winner) => `<@${winner}>`).join(", ") : "No valid entries.";
    await channel.send({
      content: `${reroll ? "Rerolled" : "Ended"} giveaway **${giveaway.prize}**. Winners: ${winnerText}`
    });

    if (giveaway.messageId) {
      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      const entryCount = await context.prisma.giveawayEntry.count({
        where: {
          giveawayId: giveaway.id
        }
      });
      await message
        ?.edit({
          embeds: [buildGiveawayEmbed(updated, entryCount).setTitle("Giveaway ended")],
          components: [buildGiveawayButton(giveaway.id, true)]
        })
        .catch(() => null);
    }
  }

  return updated;
}

export async function checkExpiredGiveaways(context: CommandContext) {
  const giveaways = await context.prisma.giveaway.findMany({
    where: {
      status: GiveawayStatus.ACTIVE,
      endsAt: {
        lte: new Date()
      }
    },
    take: 20
  });

  for (const giveaway of giveaways) {
    await endGiveaway(context, giveaway.id).catch((error) => {
      context.logger.warn("Failed to end expired giveaway", {
        giveawayId: giveaway.id,
        error
      });
    });
  }
}

export async function handleGiveawayButton(interaction: ButtonInteraction, context: CommandContext) {
  if (!interaction.customId.startsWith(buttonPrefix) || !interaction.inGuild()) {
    return false;
  }

  const giveawayId = interaction.customId.slice(buttonPrefix.length);
  const giveaway = await context.prisma.giveaway.findUnique({
    where: {
      id: giveawayId
    }
  });

  if (!giveaway || giveaway.status !== GiveawayStatus.ACTIVE || giveaway.endsAt <= new Date()) {
    await interaction.reply({
      content: "This giveaway is no longer active.",
      ephemeral: true
    });
    return true;
  }

  const moduleEnabled = await isGuildModuleEnabled(context.prisma, interaction.guildId, "GIVEAWAYS");

  if (!moduleEnabled) {
    await interaction.reply({
      content: "Giveaways are disabled for this server.",
      ephemeral: true
    });
    return true;
  }

  if (giveaway.requiredRoleId) {
    const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

    if (!member?.roles.cache.has(giveaway.requiredRoleId)) {
      await interaction.reply({
        content: "You do not have the required role for this giveaway.",
        ephemeral: true
      });
      return true;
    }
  }

  await context.prisma.giveawayEntry.upsert({
    where: {
      giveawayId_userId: {
        giveawayId,
        userId: interaction.user.id
      }
    },
    create: {
      guildId: interaction.guildId,
      giveawayId,
      userId: interaction.user.id
    },
    update: {}
  });

  await interaction.reply({
    content: "You are entered in the giveaway.",
    ephemeral: true
  });
  return true;
}
