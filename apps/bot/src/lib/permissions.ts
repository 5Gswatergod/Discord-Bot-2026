import { PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";

export function hasGuildPermission(
  interaction: ChatInputCommandInteraction,
  permission: bigint
) {
  const permissions = interaction.memberPermissions;

  if (!permissions) {
    return false;
  }

  return permissions.has(permission);
}

export async function requireGuildPermission(
  interaction: ChatInputCommandInteraction,
  permission: bigint,
  label: string
) {
  if (hasGuildPermission(interaction, permission)) {
    return true;
  }

  await interaction.reply({
    content: `你需要「${label}」權限才能使用此指令。`,
    ephemeral: true
  });
  return false;
}

export function hasModeratorPermission(interaction: ChatInputCommandInteraction) {
  return hasGuildPermission(interaction, PermissionFlagsBits.ModerateMembers);
}
