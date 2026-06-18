import { hasManageGuildPermission } from "@guildforge/shared";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

type DiscordGuildPayload = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  approximate_member_count?: number;
};

export type ManageableGuild = {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  permissions: string;
  memberCount: number | null;
  botJoined: boolean;
  inviteUrl: string;
};

function buildGuildIconUrl(guild: DiscordGuildPayload) {
  if (!guild.icon) {
    return null;
  }

  const extension = guild.icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${extension}?size=128`;
}

export function buildBotInviteUrl(guildId?: string) {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    permissions: String(env.DISCORD_BOT_PERMISSIONS),
    scope: "bot applications.commands"
  });

  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

async function fetchDiscordGuilds(accessToken: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me/guilds?with_counts=true", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Discord guild fetch failed with status ${response.status}`);
  }

  return (await response.json()) as DiscordGuildPayload[];
}

export async function getManageableGuilds(accessToken: string): Promise<ManageableGuild[]> {
  const guilds = (await fetchDiscordGuilds(accessToken)).filter((guild) =>
    hasManageGuildPermission(guild.permissions)
  );

  const botGuilds = await prisma.guild.findMany({
    where: {
      id: {
        in: guilds.map((guild) => guild.id)
      }
    },
    select: {
      id: true,
      memberCount: true
    }
  });
  const botGuildMap = new Map(botGuilds.map((guild) => [guild.id, guild]));

  return guilds.map((guild) => {
    const botGuild = botGuildMap.get(guild.id);

    return {
      id: guild.id,
      name: guild.name,
      iconUrl: buildGuildIconUrl(guild),
      owner: guild.owner,
      permissions: guild.permissions,
      memberCount: botGuild?.memberCount ?? guild.approximate_member_count ?? null,
      botJoined: Boolean(botGuild),
      inviteUrl: buildBotInviteUrl(guild.id)
    };
  });
}
