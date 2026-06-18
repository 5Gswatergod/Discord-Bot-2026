import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { PollVisibility } from "@guildforge/database";

import type { BotCommand } from "../types";
import { isSendableGuildTextChannel } from "../../lib/channels";
import { isGuildModuleEnabled } from "../../lib/modules";
import { publishPollMessage } from "../../lib/polls/polls";
import { parseDurationToSeconds } from "../../lib/time";

export const pollCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create polls.")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a button poll.")
        .addStringOption((option) =>
          option.setName("question").setDescription("Poll question.").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("options")
            .setDescription("Separate 2-10 options with |")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("visibility")
            .setDescription("Whether results are visible.")
            .addChoices(
              { name: "Public", value: "PUBLIC" },
              { name: "Anonymous", value: "ANONYMOUS" }
            )
        )
        .addStringOption((option) =>
          option.setName("duration").setDescription("Optional duration such as 1h or 3d.")
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to post in.")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
    ),
  async execute(interaction, context) {
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: "This command can only be used inside a server.",
        ephemeral: true
      });
      return;
    }

    if (!interaction.memberPermissions?.any([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild])) {
      await interaction.reply({
        content: "You need Manage Server permission to create polls.",
        ephemeral: true
      });
      return;
    }

    const enabled = await isGuildModuleEnabled(context.prisma, guildId, "POLLS");

    if (!enabled) {
      await interaction.reply({
        content: "Polls are disabled for this server.",
        ephemeral: true
      });
      return;
    }

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;

    if (!isSendableGuildTextChannel(channel)) {
      await interaction.reply({
        content: "Polls need a text channel.",
        ephemeral: true
      });
      return;
    }

    const labels = interaction.options
      .getString("options", true)
      .split("|")
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (labels.length < 2) {
      await interaction.reply({
        content: "Provide at least 2 options separated with |.",
        ephemeral: true
      });
      return;
    }

    const duration = interaction.options.getString("duration");
    const durationSeconds = duration ? parseDurationToSeconds(duration) : null;

    if (duration && !durationSeconds) {
      await interaction.reply({
        content: "Duration must look like 1h or 3d.",
        ephemeral: true
      });
      return;
    }

    const poll = await context.prisma.poll.create({
      data: {
        guildId,
        channelId: channel.id,
        question: interaction.options.getString("question", true),
        visibility: (interaction.options.getString("visibility") ?? "PUBLIC") as PollVisibility,
        createdByUserId: interaction.user.id,
        endsAt: durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null,
        options: {
          create: labels.map((label, index) => ({
            guildId,
            label,
            sortOrder: index
          }))
        }
      }
    });
    const message = await publishPollMessage(context, poll.id);

    await interaction.reply({
      content: message ? `Created poll ${poll.id}: ${message.url}` : `Created poll ${poll.id}.`,
      ephemeral: true
    });
  }
};

export const pollCommands = [pollCommand] satisfies BotCommand[];
