import { PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";

export function hasModeratorPermission(interaction: ChatInputCommandInteraction) {
  const permissions = interaction.memberPermissions;

  if (!permissions) {
    return false;
  }

  return permissions.any([
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers
  ]);
}
