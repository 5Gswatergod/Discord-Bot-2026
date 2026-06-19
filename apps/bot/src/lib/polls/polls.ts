import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction
} from "discord.js";

import { PollVisibility, type Poll, type PollOption } from "@guildforge/database";

import type { CommandContext } from "../../commands/types";
import { isSendableGuildTextChannel } from "../channels";
import { isGuildModuleEnabled } from "../modules";

const buttonPrefix = "poll:";

function buildRows(pollId: string, options: PollOption[], disabled = false) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (let index = 0; index < options.length; index += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();

    for (const option of options.slice(index, index + 5)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${buttonPrefix}${pollId}:${option.id}`)
          .setLabel(option.label)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      );
    }

    rows.push(row);
  }

  return rows;
}

function buildPollEmbed(poll: Poll, options: Array<PollOption & { votes?: number }>) {
  return new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle("投票")
    .setDescription(poll.question)
    .addFields(
      ...options.map((option) => ({
        name: option.label,
        value:
          poll.visibility === PollVisibility.PUBLIC
            ? `${option.votes ?? 0} 票`
            : "票數不公開",
        inline: true
      })),
      {
        name: "投票 ID",
        value: poll.id
      }
    )
    .setTimestamp();
}

async function getPollWithVoteCounts(context: CommandContext, pollId: string) {
  const poll = await context.prisma.poll.findUnique({
    where: {
      id: pollId
    },
    include: {
      options: {
        orderBy: {
          sortOrder: "asc"
        }
      }
    }
  });

  if (!poll) {
    return null;
  }

  const counts = await context.prisma.pollVote.groupBy({
    by: ["optionId"],
    where: {
      pollId
    },
    _count: true
  });
  const countMap = new Map(counts.map((count) => [count.optionId, count._count]));

  return {
    poll,
    options: poll.options.map((option) => ({
      ...option,
      votes: countMap.get(option.id) ?? 0
    }))
  };
}

export async function publishPollMessage(context: CommandContext, pollId: string) {
  const pollData = await getPollWithVoteCounts(context, pollId);

  if (!pollData) {
    return null;
  }

  const guild = await context.client.guilds.fetch(pollData.poll.guildId).catch(() => null);
  const channel = guild ? await guild.channels.fetch(pollData.poll.channelId).catch(() => null) : null;

  if (!isSendableGuildTextChannel(channel)) {
    return null;
  }

  const message = await channel.send({
    embeds: [buildPollEmbed(pollData.poll, pollData.options)],
    components: buildRows(pollData.poll.id, pollData.poll.options)
  });

  await context.prisma.poll.update({
    where: {
      id: pollId
    },
    data: {
      messageId: message.id
    }
  });

  return message;
}

export async function refreshPollMessage(context: CommandContext, pollId: string) {
  const pollData = await getPollWithVoteCounts(context, pollId);

  if (!pollData?.poll.messageId) {
    return;
  }

  const guild = await context.client.guilds.fetch(pollData.poll.guildId).catch(() => null);
  const channel = guild ? await guild.channels.fetch(pollData.poll.channelId).catch(() => null) : null;

  if (!isSendableGuildTextChannel(channel)) {
    return;
  }

  const message = await channel?.messages.fetch(pollData.poll.messageId).catch(() => null);

  await message
    ?.edit({
      embeds: [buildPollEmbed(pollData.poll, pollData.options)],
      components: buildRows(pollData.poll.id, pollData.poll.options)
    })
    .catch(() => null);
}

export async function handlePollButton(interaction: ButtonInteraction, context: CommandContext) {
  if (!interaction.customId.startsWith(buttonPrefix) || !interaction.inGuild()) {
    return false;
  }

  const [, pollId, optionId] = interaction.customId.split(":");
  const poll = await context.prisma.poll.findUnique({
    where: {
      id: pollId
    }
  });

  if (!poll || (poll.endsAt && poll.endsAt <= new Date())) {
    await interaction.reply({
      content: "此投票已結束。",
      ephemeral: true
    });
    return true;
  }

  const enabled = await isGuildModuleEnabled(context.prisma, interaction.guildId, "POLLS");

  if (!enabled) {
    await interaction.reply({
      content: "此伺服器已停用投票功能。",
      ephemeral: true
    });
    return true;
  }

  await context.prisma.pollVote.upsert({
    where: {
      pollId_userId: {
        pollId,
        userId: interaction.user.id
      }
    },
    create: {
      guildId: interaction.guildId,
      pollId,
      optionId,
      userId: interaction.user.id
    },
    update: {
      optionId
    }
  });

  await refreshPollMessage(context, pollId);

  await interaction.reply({
    content:
      poll.visibility === PollVisibility.PUBLIC
        ? "已儲存你的投票，公開結果已更新。"
        : "已儲存你的投票。",
    ephemeral: true
  });
  return true;
}
