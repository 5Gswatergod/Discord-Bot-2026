import {
  moduleDescriptions,
  moduleKeys,
  moduleLabels,
  type GuildModuleKey
} from "@guildforge/shared";

export interface ModuleDefinition {
  key: GuildModuleKey;
  label: string;
  description: string;
  phase: 1 | 2 | 3 | 4 | 5;
}

const phaseByModule: Record<GuildModuleKey, ModuleDefinition["phase"]> = {
  MODERATION: 2,
  AUTO_MODERATION: 3,
  LEVELING: 3,
  ECONOMY: 5,
  WELCOME: 2,
  REACTION_ROLES: 4,
  CUSTOM_COMMANDS: 3,
  LOGGING: 2,
  GIVEAWAYS: 4,
  POLLS: 4,
  SOCIAL_ALERTS: 5,
  TICKETS: 5,
  INVITE_TRACKING: 5,
  EMBED_MESSAGES: 5,
  REMINDERS: 5,
  STARBOARD: 5,
  ACHIEVEMENTS: 5,
  BIRTHDAYS: 5,
  SERVER_STATS: 5,
  TEMPORARY_VOICE: 5,
  AUTOMATIONS: 5
};

export const moduleDefinitions: ModuleDefinition[] = moduleKeys.map((key) => ({
  key,
  label: moduleLabels[key],
  description: moduleDescriptions[key],
  phase: phaseByModule[key]
}));
