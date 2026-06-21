export type DiscordChannelResource = {
  id: string;
  name: string;
  type: number;
  typeLabel: string;
  parentId: string | null;
  parentName: string | null;
  position: number;
};

export type DiscordRoleResource = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  assignable: boolean;
};

export type DiscordGuildResources = {
  channels: DiscordChannelResource[];
  roles: DiscordRoleResource[];
};
