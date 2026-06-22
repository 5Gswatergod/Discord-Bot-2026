import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";
import { isGuildModuleEnabled } from "../../lib/modules";

async function requireOwnedChannel(
  interaction: Parameters<BotCommand["execute"]>[0],
  context: Parameters<BotCommand["execute"]>[1]
) {
  if (!interaction.guildId || !interaction.guild || !interaction.member) {
    await interaction.reply({ content: "此指令只能在伺服器內使用。", ephemeral: true });
    return null;
  }

  if (!(await isGuildModuleEnabled(context.prisma, interaction.guildId, "TEMPORARY_VOICE"))) {
    await interaction.reply({ content: "此伺服器已停用臨時語音頻道。", ephemeral: true });
    return null;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const channelId = member.voice.channelId;

  if (!channelId) {
    await interaction.reply({ content: "你目前不在語音頻道中。", ephemeral: true });
    return null;
  }

  const record = await context.prisma.temporaryVoiceChannel.findUnique({
    where: { channelId }
  });

  if (
    !record ||
    (record.ownerUserId !== interaction.user.id &&
      !member.permissions.has(PermissionFlagsBits.ManageChannels))
  ) {
    await interaction.reply({ content: "你不是此臨時語音頻道的擁有者。", ephemeral: true });
    return null;
  }

  const channel = await interaction.guild.channels.fetch(channelId);

  if (channel?.type !== ChannelType.GuildVoice) {
    await interaction.reply({ content: "找不到臨時語音頻道。", ephemeral: true });
    return null;
  }

  return channel;
}

export const voiceCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setNameLocalizations({ "zh-TW": "語音房" })
    .setDescription("管理你的臨時語音頻道。")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("rename")
        .setNameLocalizations({ "zh-TW": "重新命名" })
        .setDescription("重新命名目前的臨時語音頻道。")
        .addStringOption((option) =>
          option
            .setName("name")
            .setNameLocalizations({ "zh-TW": "名稱" })
            .setDescription("新的頻道名稱。")
            .setMinLength(1)
            .setMaxLength(100)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("limit")
        .setNameLocalizations({ "zh-TW": "人數限制" })
        .setDescription("調整臨時語音頻道的人數限制。")
        .addIntegerOption((option) =>
          option
            .setName("users")
            .setNameLocalizations({ "zh-TW": "人數" })
            .setDescription("0 代表無限制。")
            .setMinValue(0)
            .setMaxValue(99)
            .setRequired(true)
        )
    ),
  async execute(interaction, context) {
    const channel = await requireOwnedChannel(interaction, context);

    if (!channel) {
      return;
    }

    if (interaction.options.getSubcommand() === "rename") {
      await channel.setName(
        interaction.options.getString("name", true),
        `Hydrava voice rename by ${interaction.user.tag}`
      );
      await interaction.reply({ content: "已重新命名語音頻道。", ephemeral: true });
      return;
    }

    await channel.setUserLimit(
      interaction.options.getInteger("users", true),
      `Hydrava voice limit by ${interaction.user.tag}`
    );
    await interaction.reply({ content: "已更新語音頻道人數限制。", ephemeral: true });
  }
};

export const temporaryVoiceCommands = [voiceCommand] satisfies BotCommand[];
