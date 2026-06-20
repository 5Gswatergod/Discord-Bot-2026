import { z } from "zod";

export const moduleKeys = [
  "MODERATION",
  "AUTO_MODERATION",
  "LEVELING",
  "ECONOMY",
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
  MODERATION: "管理功能",
  AUTO_MODERATION: "自動管理",
  LEVELING: "等級與經驗值",
  ECONOMY: "貨幣與商店",
  WELCOME: "歡迎與離開訊息",
  REACTION_ROLES: "自助身分組",
  CUSTOM_COMMANDS: "自訂指令",
  LOGGING: "伺服器紀錄",
  GIVEAWAYS: "抽獎",
  POLLS: "投票",
  SOCIAL_ALERTS: "社群通知"
};

export const moduleDescriptions: Record<GuildModuleKey, string> = {
  MODERATION: "封鎖、踢除、禁言、警告、慢速模式、頻道鎖定與管理紀錄。",
  AUTO_MODERATION: "訊息過濾、洗頻偵測、提及限制與自動處罰。",
  LEVELING: "經驗值、等級卡、排行榜、身分組獎勵與防洗經驗冷卻。",
  ECONOMY: "聊天與每日獎勵、成員轉帳、貨幣排行榜、商店與收藏品。",
  WELCOME: "使用範本、嵌入訊息與自動身分組處理加入及離開通知。",
  REACTION_ROLES: "使用表情反應或按鈕領取身分組，支援單選與多選。",
  CUSTOM_COMMANDS: "可設定冷卻、變數與權限的自訂前綴指令。",
  LOGGING: "記錄訊息、成員、身分組、頻道、語音與管理事件。",
  GIVEAWAYS: "使用按鈕參加抽獎，支援身分組限制、重新抽取與得獎公告。",
  POLLS: "使用按鈕投票，支援公開或匿名結果。",
  SOCIAL_ALERTS: "定時檢查 YouTube、Twitch 與 RSS 並發送通知。"
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
  MESSAGE_DELETE: "訊息已刪除",
  MESSAGE_UPDATE: "訊息已編輯",
  MEMBER_JOIN: "成員加入",
  MEMBER_LEAVE: "成員離開",
  MEMBER_BAN: "成員遭封鎖",
  MEMBER_UNBAN: "成員解除封鎖",
  ROLE_CREATE: "身分組已建立",
  ROLE_DELETE: "身分組已刪除",
  CHANNEL_CREATE: "頻道已建立",
  CHANNEL_DELETE: "頻道已刪除",
  VOICE_JOIN: "加入語音頻道",
  VOICE_LEAVE: "離開語音頻道",
  MODERATION_ACTION: "管理操作"
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
  welcomeMessage: z.string().min(1).max(1_500).default("歡迎 {user} 加入 {server}！"),
  goodbyeChannelId: optionalSnowflakeSchema.default(null),
  goodbyeMessage: z.string().min(1).max(1_500).default("{username} 離開了 {server}。"),
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
  levelUpMessage: z.string().min(1).max(1_500).default("{user} 在 {server} 升到了等級 {level}！"),
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

export const economyMaxBalance = 2_000_000_000;

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const economySettingsSchema = z
  .object({
    currencyName: z.string().trim().min(1).max(32).default("金幣"),
    currencySymbol: z.string().trim().min(1).max(8).default("G"),
    messageRewardsEnabled: z.boolean().default(true),
    messageRewardMin: z.coerce.number().int().min(0).max(100_000).default(1),
    messageRewardMax: z.coerce.number().int().min(0).max(100_000).default(3),
    messageRewardCooldownSeconds: z.coerce.number().int().min(5).max(86_400).default(60),
    messageIgnoredChannelIds: z.array(snowflakeSchema).default([]),
    messageIgnoredRoleIds: z.array(snowflakeSchema).default([]),
    dailyRewardsEnabled: z.boolean().default(true),
    dailyBaseReward: z.coerce.number().int().min(0).max(10_000_000).default(100),
    dailyStreakBonus: z.coerce.number().int().min(0).max(1_000_000).default(10),
    dailyStreakCap: z.coerce.number().int().min(1).max(365).default(7),
    timeZone: z.string().trim().refine(isValidTimeZone, "時區格式不正確").default("Asia/Taipei"),
    transfersEnabled: z.boolean().default(true),
    transferFeePercent: z.coerce.number().min(0).max(25).default(0),
    minimumTransfer: z.coerce.number().int().min(1).max(economyMaxBalance).default(1),
    levelRewardsEnabled: z.boolean().default(true),
    levelRewardBase: z.coerce.number().int().min(0).max(10_000_000).default(25),
    levelRewardMultiplier: z.coerce.number().int().min(0).max(1_000_000).default(5)
  })
  .superRefine((settings, context) => {
    if (settings.messageRewardMax < settings.messageRewardMin) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messageRewardMax"],
        message: "聊天獎勵最大值不可小於最小值"
      });
    }
  });

export type EconomySettings = z.infer<typeof economySettingsSchema>;

export const economyShopItemTypes = ["ROLE", "COLLECTIBLE"] as const;
export const economyShopItemStatuses = ["ACTIVE", "DISABLED", "ARCHIVED"] as const;

export const economyShopItemTypeLabels: Record<(typeof economyShopItemTypes)[number], string> = {
  ROLE: "Discord 身分組",
  COLLECTIBLE: "收藏品"
};

export const economyShopItemStatusLabels: Record<(typeof economyShopItemStatuses)[number], string> =
  {
    ACTIVE: "上架中",
    DISABLED: "已停用",
    ARCHIVED: "已封存"
  };

export const economyShopItemInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional().nullable(),
    type: z.enum(economyShopItemTypes),
    price: z.coerce.number().int().min(1).max(economyMaxBalance),
    roleId: optionalSnowflakeSchema.default(null),
    stock: z.coerce.number().int().min(0).max(economyMaxBalance).optional().nullable(),
    soldCount: z.coerce.number().int().min(0).default(0),
    perUserLimit: z.coerce.number().int().min(1).max(1_000_000).optional().nullable(),
    status: z.enum(economyShopItemStatuses).default("ACTIVE")
  })
  .superRefine((item, context) => {
    if (item.type === "ROLE" && !item.roleId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roleId"],
        message: "身分組商品必須設定身分組 ID"
      });
    }

    if (item.stock !== null && item.stock !== undefined && item.stock < item.soldCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stock"],
        message: "庫存不可低於已售數量"
      });
    }
  });

export const economyUpdateSchema = economySettingsSchema;
export const economyShopUpdateSchema = z.object({
  items: z.array(economyShopItemInputSchema).max(200)
});

export type EconomyShopItemInput = z.infer<typeof economyShopItemInputSchema>;

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
  BANNED_WORD: "禁用詞",
  SPAM: "洗頻",
  LINK: "外部連結",
  MASS_MENTION: "大量提及",
  INVITE_LINK: "Discord 邀請連結",
  REPEATED_MESSAGE: "重複訊息",
  CAPS_LOCK: "大量大寫字母"
};

export const autoModPunishments = ["DELETE_MESSAGE", "WARN", "TIMEOUT", "KICK", "BAN"] as const;

export type AutoModPunishmentKey = (typeof autoModPunishments)[number];

export const autoModPunishmentLabels: Record<AutoModPunishmentKey, string> = {
  DELETE_MESSAGE: "刪除訊息",
  WARN: "警告",
  TIMEOUT: "禁言",
  KICK: "踢除",
  BAN: "封鎖"
};

export const autoModRuleInputSchema = z.object({
  trigger: z.enum(autoModTriggers),
  enabled: z.boolean(),
  punishment: z.enum(autoModPunishments).default("DELETE_MESSAGE"),
  punishmentDurationSeconds: z.coerce
    .number()
    .int()
    .min(60)
    .max(2_419_200)
    .nullable()
    .default(null),
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
  RSS: "RSS 訂閱"
};

export const defaultSocialAlertTemplates: Record<SocialAlertTypeKey, string> = {
  YOUTUBE: "{source} 發布了新的 YouTube 影片：**{title}**\n{url}",
  TWITCH: "{author} 正在 Twitch 直播：**{title}**\n{url}",
  RSS: "{source} 發布了新文章：**{title}**\n{url}"
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
        message: "此社群通知需要有效的來源網址。"
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
          message: "每種通知類型只能設定一次相同來源。"
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
