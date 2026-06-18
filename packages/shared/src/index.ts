import { z } from "zod";

export const moduleKeys = [
  "MODERATION",
  "AUTO_MODERATION",
  "LEVELING",
  "WELCOME",
  "REACTION_ROLES",
  "CUSTOM_COMMANDS",
  "LOGGING",
  "GIVEAWAYS",
  "POLLS",
  "SOCIAL_ALERTS"
] as const;

export type GuildModuleKey = (typeof moduleKeys)[number];

export const moduleLabels: Record<GuildModuleKey, string> = {
  MODERATION: "Moderation",
  AUTO_MODERATION: "Auto Moderation",
  LEVELING: "Leveling",
  WELCOME: "Welcome",
  REACTION_ROLES: "Reaction Roles",
  CUSTOM_COMMANDS: "Custom Commands",
  LOGGING: "Logging",
  GIVEAWAYS: "Giveaways",
  POLLS: "Polls",
  SOCIAL_ALERTS: "Social Alerts"
};

export const moduleDescriptions: Record<GuildModuleKey, string> = {
  MODERATION: "Ban, kick, timeout, warnings, slowmode, lock, and audit trails.",
  AUTO_MODERATION: "Message filters, spam detection, mention caps, and automated punishments.",
  LEVELING: "XP, rank cards, leaderboards, role rewards, and anti-farming cooldowns.",
  WELCOME: "Join and leave messages with templates, embeds, and auto roles.",
  REACTION_ROLES: "Reaction and button role panels with single or multi-select modes.",
  CUSTOM_COMMANDS: "Configurable slash or prefix commands with cooldowns and variables.",
  LOGGING: "Guild event logging for messages, members, roles, channels, voice, and moderation.",
  GIVEAWAYS: "Button-based giveaways with role requirements, rerolls, and announcements.",
  POLLS: "Button polls with public or anonymous results.",
  SOCIAL_ALERTS: "YouTube, Twitch, and RSS notifications checked by scheduled workers."
};

export const discordPermissionBits = {
  ADMINISTRATOR: 0x8n,
  MANAGE_GUILD: 0x20n,
  MANAGE_ROLES: 0x10000000n,
  KICK_MEMBERS: 0x2n,
  BAN_MEMBERS: 0x4n,
  MODERATE_MEMBERS: 0x10000000000n
} as const;

export function hasManageGuildPermission(permissions: string | number | bigint) {
  const bits = BigInt(permissions);

  return (
    (bits & discordPermissionBits.ADMINISTRATOR) === discordPermissionBits.ADMINISTRATOR ||
    (bits & discordPermissionBits.MANAGE_GUILD) === discordPermissionBits.MANAGE_GUILD
  );
}

export const snowflakeSchema = z.string().regex(/^\d{5,25}$/);

export const guildIdParamsSchema = z.object({
  guildId: snowflakeSchema
});

export const moduleToggleSchema = z.object({
  module: z.enum(moduleKeys),
  enabled: z.boolean()
});

export const logEvents = [
  "MESSAGE_DELETE",
  "MESSAGE_UPDATE",
  "MEMBER_JOIN",
  "MEMBER_LEAVE",
  "MEMBER_BAN",
  "MEMBER_UNBAN",
  "ROLE_CREATE",
  "ROLE_DELETE",
  "CHANNEL_CREATE",
  "CHANNEL_DELETE",
  "VOICE_JOIN",
  "VOICE_LEAVE",
  "MODERATION_ACTION"
] as const;

export type GuildLogEvent = (typeof logEvents)[number];

export const logEventLabels: Record<GuildLogEvent, string> = {
  MESSAGE_DELETE: "Message deleted",
  MESSAGE_UPDATE: "Message edited",
  MEMBER_JOIN: "Member joined",
  MEMBER_LEAVE: "Member left",
  MEMBER_BAN: "Member banned",
  MEMBER_UNBAN: "Member unbanned",
  ROLE_CREATE: "Role created",
  ROLE_DELETE: "Role deleted",
  CHANNEL_CREATE: "Channel created",
  CHANNEL_DELETE: "Channel deleted",
  VOICE_JOIN: "Voice joined",
  VOICE_LEAVE: "Voice left",
  MODERATION_ACTION: "Moderation action"
};

const optionalSnowflakeSchema = z
  .union([snowflakeSchema, z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

export const moderationSettingsSchema = z.object({
  moderatorRoleIds: z.array(snowflakeSchema).default([]),
  logChannelId: optionalSnowflakeSchema.default(null),
  muteRoleId: optionalSnowflakeSchema.default(null),
  defaultTimeoutSeconds: z.coerce.number().int().min(60).max(2_419_200).default(600)
});

export type ModerationSettings = z.infer<typeof moderationSettingsSchema>;

export const welcomeSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  welcomeChannelId: optionalSnowflakeSchema.default(null),
  welcomeMessage: z.string().min(1).max(1_500).default("Welcome {user} to {server}!"),
  goodbyeChannelId: optionalSnowflakeSchema.default(null),
  goodbyeMessage: z.string().min(1).max(1_500).default("{username} left {server}."),
  autoRoleId: optionalSnowflakeSchema.default(null),
  useEmbed: z.boolean().default(true),
  embedColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#24b47e")
});

export type WelcomeSettings = z.infer<typeof welcomeSettingsSchema>;

export const logConfigInputSchema = z.object({
  event: z.enum(logEvents),
  enabled: z.boolean(),
  channelId: optionalSnowflakeSchema.default(null)
});

export const loggingSettingsSchema = z.object({
  configs: z.array(logConfigInputSchema)
});

export type LoggingSettings = z.infer<typeof loggingSettingsSchema>;

export const levelingFormulaKeys = ["LINEAR", "QUADRATIC"] as const;

export type LevelingFormulaKey = (typeof levelingFormulaKeys)[number];

export const levelingSettingsSchema = z.object({
  xpPerMessage: z.coerce.number().int().min(1).max(500).default(15),
  cooldownSeconds: z.coerce.number().int().min(5).max(86_400).default(60),
  formula: z.enum(levelingFormulaKeys).default("QUADRATIC"),
  baseXp: z.coerce.number().int().min(25).max(10_000).default(100),
  levelUpChannelId: optionalSnowflakeSchema.default(null),
  levelUpMessage: z
    .string()
    .min(1)
    .max(1_500)
    .default("{user} reached level {level} in {server}!"),
  ignoredChannelIds: z.array(snowflakeSchema).default([])
});

export type LevelingSettings = z.infer<typeof levelingSettingsSchema>;

export const levelRewardInputSchema = z.object({
  level: z.coerce.number().int().min(1).max(1_000),
  roleId: snowflakeSchema,
  stackable: z.boolean().default(true)
});

export const levelingUpdateSchema = levelingSettingsSchema.extend({
  rewards: z.array(levelRewardInputSchema).default([])
});

export type LevelingUpdate = z.infer<typeof levelingUpdateSchema>;

export function getXpForLevel(level: number, settings: LevelingSettings) {
  if (level <= 0) {
    return 0;
  }

  if (settings.formula === "LINEAR") {
    return settings.baseXp * level;
  }

  return settings.baseXp * level * level;
}

export function getLevelFromXp(xp: number, settings: LevelingSettings) {
  let level = 0;

  while (getXpForLevel(level + 1, settings) <= xp) {
    level += 1;
  }

  return level;
}

export const autoModTriggers = [
  "BANNED_WORD",
  "SPAM",
  "LINK",
  "MASS_MENTION",
  "INVITE_LINK",
  "REPEATED_MESSAGE",
  "CAPS_LOCK"
] as const;

export type AutoModTriggerKey = (typeof autoModTriggers)[number];

export const autoModTriggerLabels: Record<AutoModTriggerKey, string> = {
  BANNED_WORD: "Banned words",
  SPAM: "Spam",
  LINK: "Links",
  MASS_MENTION: "Mass mentions",
  INVITE_LINK: "Discord invites",
  REPEATED_MESSAGE: "Repeated messages",
  CAPS_LOCK: "Caps lock"
};

export const autoModPunishments = ["DELETE_MESSAGE", "WARN", "TIMEOUT", "KICK", "BAN"] as const;

export const autoModRuleInputSchema = z.object({
  trigger: z.enum(autoModTriggers),
  enabled: z.boolean(),
  punishment: z.enum(autoModPunishments).default("DELETE_MESSAGE"),
  punishmentDurationSeconds: z.coerce.number().int().min(60).max(2_419_200).nullable().default(null),
  ignoredChannelIds: z.array(snowflakeSchema).default([]),
  ignoredRoleIds: z.array(snowflakeSchema).default([]),
  pattern: z
    .object({
      words: z.array(z.string().min(1).max(80)).default([]),
      maxMessages: z.coerce.number().int().min(2).max(30).default(5),
      windowSeconds: z.coerce.number().int().min(3).max(120).default(10),
      maxMentions: z.coerce.number().int().min(1).max(100).default(5),
      repeatedLimit: z.coerce.number().int().min(2).max(20).default(3),
      capsMinLength: z.coerce.number().int().min(5).max(500).default(12),
      capsPercentage: z.coerce.number().min(0.5).max(1).default(0.7)
    })
    .default({})
});

export const autoModUpdateSchema = z.object({
  rules: z.array(autoModRuleInputSchema)
});

export type AutoModRuleInput = z.infer<typeof autoModRuleInputSchema>;
export type AutoModUpdate = z.infer<typeof autoModUpdateSchema>;

export const customCommandInputSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9_-]+$/),
  description: z.string().max(100).optional().nullable(),
  responseText: z.string().min(1).max(1_500),
  cooldownSeconds: z.coerce.number().int().min(0).max(86_400).default(5),
  allowedRoleIds: z.array(snowflakeSchema).default([]),
  allowedChannelIds: z.array(snowflakeSchema).default([]),
  enabled: z.boolean().default(true)
});

export const customCommandUpdateSchema = z.object({
  commandPrefix: z.string().min(1).max(5).default("!"),
  commands: z.array(customCommandInputSchema).max(100)
});

export type CustomCommandInput = z.infer<typeof customCommandInputSchema>;

export const reactionRoleModes = ["MULTI_SELECT", "SINGLE_SELECT"] as const;

export const reactionRoleOptionInputSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["BUTTON", "REACTION"]).default("BUTTON"),
  roleId: snowflakeSchema,
  emoji: z.string().max(64).optional().nullable(),
  label: z.string().min(1).max(80),
  sortOrder: z.coerce.number().int().min(0).max(100).default(0)
});

export const reactionRolePanelInputSchema = z.object({
  id: z.string().optional(),
  channelId: snowflakeSchema,
  title: z.string().min(1).max(256),
  description: z.string().max(1_500).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#24b47e"),
  mode: z.enum(reactionRoleModes).default("MULTI_SELECT"),
  enabled: z.boolean().default(true),
  options: z.array(reactionRoleOptionInputSchema).min(1).max(25)
});

export const reactionRolePanelsUpdateSchema = z.object({
  panels: z.array(reactionRolePanelInputSchema).max(25)
});

export type ReactionRolePanelInput = z.infer<typeof reactionRolePanelInputSchema>;

export const giveawayInputSchema = z.object({
  id: z.string().optional(),
  channelId: snowflakeSchema,
  prize: z.string().min(1).max(256),
  winnerCount: z.coerce.number().int().min(1).max(25).default(1),
  requiredRoleId: optionalSnowflakeSchema.default(null),
  endsAt: z.coerce.date()
});

export const giveawaysUpdateSchema = z.object({
  giveaways: z.array(giveawayInputSchema).max(50)
});

export type GiveawayInput = z.infer<typeof giveawayInputSchema>;

export const pollVisibilityKeys = ["PUBLIC", "ANONYMOUS"] as const;

export const pollInputSchema = z.object({
  id: z.string().optional(),
  channelId: snowflakeSchema,
  question: z.string().min(1).max(256),
  visibility: z.enum(pollVisibilityKeys).default("PUBLIC"),
  endsAt: z.coerce.date().optional().nullable(),
  options: z.array(z.string().min(1).max(80)).min(2).max(10)
});

export const pollsUpdateSchema = z.object({
  polls: z.array(pollInputSchema).max(50)
});

export type PollInput = z.infer<typeof pollInputSchema>;

export const socialAlertTypes = ["YOUTUBE", "TWITCH", "RSS"] as const;

export type SocialAlertTypeKey = (typeof socialAlertTypes)[number];

export const socialAlertTypeLabels: Record<SocialAlertTypeKey, string> = {
  YOUTUBE: "YouTube",
  TWITCH: "Twitch",
  RSS: "RSS"
};

export const defaultSocialAlertTemplates: Record<SocialAlertTypeKey, string> = {
  YOUTUBE: "New YouTube upload from {source}: **{title}**\n{url}",
  TWITCH: "{author} is live on Twitch: **{title}**\n{url}",
  RSS: "New post from {source}: **{title}**\n{url}"
};

export function buildSocialAlertSourceUrl(
  type: SocialAlertTypeKey,
  sourceId: string,
  sourceUrl?: string | null
) {
  const trimmedSourceId = sourceId.trim();
  const trimmedSourceUrl = sourceUrl?.trim();

  if (trimmedSourceUrl) {
    return trimmedSourceUrl;
  }

  if (type === "YOUTUBE" && trimmedSourceId.startsWith("UC")) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(trimmedSourceId)}`;
  }

  if (type === "TWITCH") {
    return `https://www.twitch.tv/${encodeURIComponent(trimmedSourceId)}`;
  }

  return trimmedSourceId;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const socialAlertInputSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(socialAlertTypes).default("RSS"),
    sourceId: z.string().min(1).max(200),
    sourceUrl: z.string().max(2_048).optional().default(""),
    channelId: snowflakeSchema,
    messageTemplate: z.string().min(1).max(1_500),
    intervalSeconds: z.coerce.number().int().min(60).max(86_400).default(300),
    enabled: z.boolean().default(true)
  })
  .superRefine((alert, context) => {
    const sourceUrl = buildSocialAlertSourceUrl(alert.type, alert.sourceId, alert.sourceUrl);

    if (!isHttpUrl(sourceUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceUrl"],
        message: "A valid source URL is required for this social alert."
      });
    }
  });

export const socialAlertsUpdateSchema = z
  .object({
    alerts: z.array(socialAlertInputSchema).max(100)
  })
  .superRefine((input, context) => {
    const keys = new Set<string>();

    for (const [index, alert] of input.alerts.entries()) {
      const key = `${alert.type}:${alert.sourceId.toLowerCase()}`;

      if (keys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["alerts", index, "sourceId"],
          message: "Each source can only be configured once per alert type."
        });
      }

      keys.add(key);
    }
  });

export type SocialAlertInput = z.infer<typeof socialAlertInputSchema>;

export function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
