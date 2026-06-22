import { env } from "@/lib/env";
import type {
  DiscordChannelResource,
  DiscordGuildResources,
  DiscordRoleResource
} from "@/types/discord-resources";

type DiscordChannelPayload = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
};

type DiscordRolePayload = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
};

type DiscordMemberPayload = {
  roles: string[];
};

type DiscordUserPayload = {
  id: string;
};

const channelTypeLabels: Record<number, string> = {
  0: "文字頻道",
  2: "語音頻道",
  4: "分類",
  5: "公告頻道",
  13: "舞台頻道",
  15: "論壇頻道",
  16: "媒體頻道"
};

async function fetchDiscordBotResource<T>(path: string): Promise<T> {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new Error(
      `Discord bot resource request failed for ${path} with status ${response.status}${
        responseBody ? `: ${responseBody.slice(0, 300)}` : ""
      }`
    );
  }

  return (await response.json()) as T;
}

export async function getDiscordGuildResources(guildId: string): Promise<DiscordGuildResources> {
  const [channels, roles, botUser] = await Promise.all([
    fetchDiscordBotResource<DiscordChannelPayload[]>(`/guilds/${guildId}/channels`),
    fetchDiscordBotResource<DiscordRolePayload[]>(`/guilds/${guildId}/roles`),
    fetchDiscordBotResource<DiscordUserPayload>("/users/@me")
  ]);
  const botMember = await fetchDiscordBotResource<DiscordMemberPayload>(
    `/guilds/${guildId}/members/${botUser.id}`
  );
  const categoryNames = new Map(
    channels.filter((channel) => channel.type === 4).map((channel) => [channel.id, channel.name])
  );
  const channelResources: DiscordChannelResource[] = channels
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      typeLabel: channelTypeLabels[channel.type] ?? "其他頻道",
      parentId: channel.parent_id ?? null,
      parentName: channel.parent_id ? (categoryNames.get(channel.parent_id) ?? null) : null,
      position: channel.position ?? 0
    }))
    .sort(
      (left, right) =>
        (left.parentName ?? "").localeCompare(right.parentName ?? "", "zh-Hant") ||
        left.position - right.position ||
        left.name.localeCompare(right.name, "zh-Hant")
    );
  const roleMap = new Map(roles.map((role) => [role.id, role]));
  const botHighestRolePosition = botMember.roles.reduce(
    (highest, roleId) => Math.max(highest, roleMap.get(roleId)?.position ?? 0),
    0
  );
  const roleResources: DiscordRoleResource[] = roles
    .filter((role) => role.id !== guildId)
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      managed: role.managed,
      assignable: !role.managed && role.position < botHighestRolePosition
    }))
    .sort((left, right) => right.position - left.position);

  return {
    channels: channelResources,
    roles: roleResources
  };
}
