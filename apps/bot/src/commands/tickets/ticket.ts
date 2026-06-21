import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { ticketSettingsSchema } from "@guildforge/shared";

import type { BotCommand } from "../types";
import { closeTicket } from "../../lib/tickets/tickets";
import { getGuildModuleSettings, isGuildModuleEnabled } from "../../lib/modules";

export const ticketCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setNameLocalizations({ "zh-TW": "客服單" })
    .setDescription("管理目前的客服單。")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("close")
        .setNameLocalizations({ "zh-TW": "關閉" })
        .setDescription("關閉目前頻道的客服單。")
        .addStringOption((option) =>
          option
            .setName("reason")
            .setNameLocalizations({ "zh-TW": "原因" })
            .setDescription("關閉原因。")
            .setMaxLength(500)
        )
    ),
  async execute(interaction, context) {
    if (!interaction.guildId || !interaction.guild || !interaction.channelId) {
      await interaction.reply({ content: "此指令只能在伺服器內使用。", ephemeral: true });
      return;
    }

    if (!(await isGuildModuleEnabled(context.prisma, interaction.guildId, "TICKETS"))) {
      await interaction.reply({ content: "此伺服器已停用客服單功能。", ephemeral: true });
      return;
    }

    const ticket = await context.prisma.ticket.findFirst({
      where: {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        status: "OPEN"
      }
    });

    if (!ticket) {
      await interaction.reply({ content: "目前頻道不是開啟中的客服單。", ephemeral: true });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const config = await getGuildModuleSettings(context.prisma, interaction.guildId, "TICKETS");
    const settings = ticketSettingsSchema.parse(config.settings ?? {});
    const isSupport = settings.supportRoleIds.some((roleId) => member.roles.cache.has(roleId));

    if (
      ticket.ownerUserId !== interaction.user.id &&
      !member.permissions.has(PermissionFlagsBits.ManageChannels) &&
      !isSupport
    ) {
      await interaction.reply({ content: "你沒有權限關閉此客服單。", ephemeral: true });
      return;
    }

    await closeTicket(
      context,
      interaction.guildId,
      interaction.channelId,
      interaction.user.id,
      interaction.options.getString("reason")
    );
    await interaction.reply("客服單已關閉，此頻道將在 10 秒後刪除。");
    const channel = interaction.channel;

    setTimeout(() => {
      if (channel && "delete" in channel) {
        void channel.delete("Hydrava ticket closed").catch(() => null);
      }
    }, 10_000);
  }
};

export const ticketCommands = [ticketCommand] satisfies BotCommand[];
