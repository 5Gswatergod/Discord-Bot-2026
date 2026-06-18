import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { GiveawayStatus } from "@guildforge/database";

import type { BotCommand } from "../types";
import { createGiveawayMessage, endGiveaway } from "../../lib/giveaways/giveaways";
import { isSendableGuildTextChannel } from "../../lib/channels";
import { isGuildModuleEnabled } from "../../lib/modules";
import { parseDurationToSeconds } from "../../lib/time";

export const giveawayCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage giveaways.")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a giveaway.")
        .addStringOption((option) =>
          option.setName("prize").setDescription("Prize to give away.").setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("duration")
            .setDescription("Duration such as 30m, 2h, or 7d.")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("winners")
            .setDescription("Number of winners.")
            .setMinValue(1)
            .setMaxValue(25)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to post in.")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addRoleOption((option) =>
          option.setName("required_role").setDescription("Required role to enter.")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("end")
        .setDescription("End a giveaway now.")
        .addStringOption((option) =>
          option.setName("giveaway_id").setDescription("Giveaway ID.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reroll")
        .setDescription("Reroll winners for an ended giveaway.")
        .addStringOption((option) =>
          option.setName("giveaway_id").setDescription("Giveaway ID.").setRequired(true)
        )
    ),
  async execute(interaction, context) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "This command can only be used inside a server.",
        ephemeral: true
      });
      return;
    }

    if (!interaction.memberPermissions?.any([PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild])) {
      await interaction.reply({
        content: "You need Manage Server permission to manage giveaways.",
        ephemeral: true
      });
      return;
    }

    const enabled = await isGuildModuleEnabled(context.prisma, interaction.guildId, "GIVEAWAYS");

    if (!enabled) {
      await interaction.reply({
        content: "Giveaways are disabled for this server.",
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const duration = interaction.options.getString("duration", true);
      const durationSeconds = parseDurationToSeconds(duration);

      if (!durationSeconds) {
        await interaction.reply({
          content: "Duration must look like 30m, 2h, or 7d.",
          ephemeral: true
        });
        return;
      }

      const channel = interaction.options.getChannel("channel") ?? interaction.channel;

      if (!isSendableGuildTextChannel(channel)) {
        await interaction.reply({
          content: "Giveaways need a text channel.",
          ephemeral: true
        });
        return;
      }

      const giveaway = await context.prisma.giveaway.create({
        data: {
          guildId: interaction.guildId,
          channelId: channel.id,
          prize: interaction.options.getString("prize", true),
          winnerCount: interaction.options.getInteger("winners") ?? 1,
          requiredRoleId: interaction.options.getRole("required_role")?.id,
          createdByUserId: interaction.user.id,
          endsAt: new Date(Date.now() + durationSeconds * 1000),
          status: GiveawayStatus.ACTIVE
        }
      });
      const message = await createGiveawayMessage(context, giveaway);

      await interaction.reply({
        content: message
          ? `Created giveaway ${giveaway.id}: ${message.url}`
          : `Created giveaway ${giveaway.id}, but I could not send the Discord message.`,
        ephemeral: true
      });
      return;
    }

    const giveawayId = interaction.options.getString("giveaway_id", true);
    const ended = await endGiveaway(context, giveawayId, subcommand === "reroll");

    await interaction.reply({
      content: ended ? `${subcommand === "reroll" ? "Rerolled" : "Ended"} giveaway ${giveawayId}.` : "Giveaway not found or already ended.",
      ephemeral: true
    });
  }
};

export const giveawayCommands = [giveawayCommand] satisfies BotCommand[];
