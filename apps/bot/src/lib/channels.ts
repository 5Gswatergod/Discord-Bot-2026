import { ChannelType, type NewsChannel, type TextChannel } from "discord.js";

export type SendableGuildTextChannel = TextChannel | NewsChannel;

export function isSendableGuildTextChannel(channel: unknown): channel is SendableGuildTextChannel {
  const type = (channel as { type?: ChannelType } | null)?.type;

  return type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement;
}
