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
  SOCIAL_ALERTS: 5
};

export const moduleDefinitions: ModuleDefinition[] = moduleKeys.map((key) => ({
  key,
  label: moduleLabels[key],
  description: moduleDescriptions[key],
  phase: phaseByModule[key]
}));
