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
  "SOCIAL_ALERTS",
  "TICKETS",
  "INVITE_TRACKING",
  "EMBED_MESSAGES",
  "REMINDERS",
  "STARBOARD",
  "ACHIEVEMENTS",
  "BIRTHDAYS",
  "SERVER_STATS",
  "TEMPORARY_VOICE",
  "AUTOMATIONS",
  "MUSIC",
  "AI_ASSISTANT",
  "MEMBERSHIPS",
  "WEB3"
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
  SOCIAL_ALERTS: "社群通知",
  TICKETS: "客服單",
  INVITE_TRACKING: "邀請追蹤",
  EMBED_MESSAGES: "嵌入訊息",
  REMINDERS: "提醒事項",
  STARBOARD: "熱門訊息牆",
  ACHIEVEMENTS: "成就與獎勵",
  BIRTHDAYS: "生日",
  SERVER_STATS: "統計頻道",
  TEMPORARY_VOICE: "臨時語音頻道",
  AUTOMATIONS: "進階自動化",
  MUSIC: "音樂播放器",
  AI_ASSISTANT: "Hydrava AI 助理",
  MEMBERSHIPS: "付費會員",
  WEB3: "NFT／Web3 驗證"
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
  SOCIAL_ALERTS: "定時檢查 YouTube、Twitch 與 RSS 並發送通知。",
  TICKETS: "建立私人客服頻道，支援客服領取、關閉與處理紀錄。",
  INVITE_TRACKING: "追蹤成員使用的邀請連結並建立邀請排行榜。",
  EMBED_MESSAGES: "透過視覺化編輯器發布及同步 Discord 嵌入訊息。",
  REMINDERS: "在指定時間發送一次性或循環提醒。",
  STARBOARD: "將獲得足夠反應的熱門訊息展示到指定頻道。",
  ACHIEVEMENTS: "依聊天、等級與邀請進度解鎖成就及身分組獎勵。",
  BIRTHDAYS: "讓成員登記生日，並在指定頻道自動送上祝福。",
  SERVER_STATS: "以 Discord 頻道名稱即時顯示成員、身分組與頻道統計。",
  TEMPORARY_VOICE: "成員加入大廳後自動建立私人臨時語音頻道。",
  AUTOMATIONS: "使用事件、條件與動作建立可排序、可測試的自動化工作流程。",
  MUSIC: "在語音頻道播放 YouTube 音樂，並支援 Spotify 連結配對與共用佇列。",
  AI_ASSISTANT: "在指定頻道提供可控成本、可自訂人格的伺服器 AI 助理。",
  MEMBERSHIPS: "同步付費權益、訂閱身分組與私人頻道存取權。",
  WEB3: "驗證 EVM 錢包與 NFT 持有資格，自動同步身分組及通知。"
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

export const musicSettingsSchema = z
  .object({
    djRoleId: snowflakeSchema.nullable().default(null),
    requestChannelIds: z.array(snowflakeSchema).max(50).default([]),
    announcementChannelId: snowflakeSchema.nullable().default(null),
    defaultVolume: z.coerce.number().int().min(1).max(100).default(60),
    maxVolume: z.coerce.number().int().min(1).max(100).default(100),
    emptyChannelTimeoutSeconds: z.coerce.number().int().min(30).max(900).default(120),
    idleTimeoutSeconds: z.coerce.number().int().min(30).max(1_800).default(300),
    maxTracksPerUser: z.coerce.number().int().min(1).max(100).default(25),
    maxQueueSize: z.coerce.number().int().min(10).max(500).default(100),
    playlistTrackLimit: z.coerce.number().int().min(1).max(200).default(50),
    allowLiveStreams: z.boolean().default(true)
  })
  .refine(
    (settings) => new Set(settings.requestChannelIds).size === settings.requestChannelIds.length,
    {
      message: "點歌頻道不可重複。",
      path: ["requestChannelIds"]
    }
  )
  .refine((settings) => settings.defaultVolume <= settings.maxVolume, {
    message: "預設音量不可高於最大音量。",
    path: ["defaultVolume"]
  });

export type MusicSettings = z.infer<typeof musicSettingsSchema>;

export const musicLoopModes = ["off", "track", "queue"] as const;
export type MusicLoopMode = (typeof musicLoopModes)[number];

export const musicTrackStatusSchema = z.object({
  title: z.string(),
  author: z.string(),
  uri: z.string().url().nullable(),
  artworkUrl: z.string().url().nullable(),
  durationMs: z.number().int().nonnegative(),
  isStream: z.boolean(),
  requesterId: snowflakeSchema.nullable()
});

export const musicStatusSchema = z.object({
  available: z.boolean(),
  redisAvailable: z.boolean(),
  spotifyConfigured: z.boolean(),
  nodeConnected: z.boolean(),
  voiceChannelId: snowflakeSchema.nullable(),
  textChannelId: snowflakeSchema.nullable(),
  paused: z.boolean(),
  volume: z.number().int().min(0).max(1_000),
  loopMode: z.enum(musicLoopModes),
  positionMs: z.number().int().nonnegative(),
  currentTrack: musicTrackStatusSchema.nullable(),
  queueSize: z.number().int().nonnegative(),
  upcomingTracks: z.array(musicTrackStatusSchema).max(10),
  updatedAt: z.string().datetime()
});

export type MusicStatus = z.infer<typeof musicStatusSchema>;

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
  options: z.array(reactionRoleOptionInputSchema).min(1).max(25),
  publishedChannelId: optionalSnowflakeSchema.optional(),
  messageId: optionalSnowflakeSchema.optional(),
  lastSyncedAt: z.string().datetime().nullable().optional(),
  lastSyncError: z.string().nullable().optional(),
  syncPending: z.boolean().optional()
}).superRefine((panel, context) => {
  const optionIds = new Set<string>();
  const roleIds = new Set<string>();
  const reactionEmojis = new Set<string>();

  panel.options.forEach((option, index) => {
    if (option.id) {
      if (optionIds.has(option.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "面板選項 ID 不可重複",
          path: ["options", index, "id"]
        });
      }
      optionIds.add(option.id);
    }

    if (roleIds.has(option.roleId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "同一面板不可重複使用相同身分組",
        path: ["options", index, "roleId"]
      });
    }
    roleIds.add(option.roleId);

    if (option.type === "REACTION" && option.emoji) {
      if (reactionEmojis.has(option.emoji)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "同一面板的反應 Emoji 不可重複",
          path: ["options", index, "emoji"]
        });
      }
      reactionEmojis.add(option.emoji);
    }
  });
});

export const reactionRolePanelsUpdateSchema = z
  .object({
    panels: z.array(reactionRolePanelInputSchema).max(25)
  })
  .superRefine((settings, context) => {
    const panelIds = new Set<string>();

    settings.panels.forEach((panel, index) => {
      if (panel.id) {
        if (panelIds.has(panel.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "面板 ID 不可重複",
            path: ["panels", index, "id"]
          });
        }
        panelIds.add(panel.id);
      }
    });
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

export const socialAlertTypes = [
  "YOUTUBE",
  "TWITCH",
  "RSS",
  "TIKTOK",
  "X",
  "BLUESKY",
  "REDDIT",
  "INSTAGRAM",
  "KICK",
  "PODCAST"
] as const;

export type SocialAlertTypeKey = (typeof socialAlertTypes)[number];

export const socialAlertTypeLabels: Record<SocialAlertTypeKey, string> = {
  YOUTUBE: "YouTube",
  TWITCH: "Twitch",
  RSS: "RSS／Atom",
  TIKTOK: "TikTok",
  X: "X",
  BLUESKY: "Bluesky",
  REDDIT: "Reddit",
  INSTAGRAM: "Instagram",
  KICK: "Kick",
  PODCAST: "Podcast"
};

export const defaultSocialAlertTemplates: Record<SocialAlertTypeKey, string> = {
  YOUTUBE: "{mention}{source} 發布了新的 YouTube 影片：**{title}**\n{url}",
  TWITCH: "{mention}{author} 正在 Twitch 直播：**{title}**\n{url}",
  RSS: "{mention}{source} 發布了新文章：**{title}**\n{url}",
  TIKTOK: "{mention}{author} 發布了新的 TikTok：**{title}**\n{url}",
  X: "{mention}{author} 在 X 發布了新貼文：**{title}**\n{url}",
  BLUESKY: "{mention}{author} 在 Bluesky 發布了新貼文：**{title}**\n{url}",
  REDDIT: "{mention}{author} 在 Reddit 發布了新內容：**{title}**\n{url}",
  INSTAGRAM: "{mention}{author} 發布了新的 Instagram 貼文：**{title}**\n{url}",
  KICK: "{mention}{author} 在 Kick 有新動態：**{title}**\n{url}",
  PODCAST: "{mention}{source} 發布了新的 Podcast 集數：**{title}**\n{url}"
};

export const socialAlertBridgeTypes = ["TIKTOK", "X", "INSTAGRAM", "KICK"] as const;

export function socialAlertNeedsBridge(type: SocialAlertTypeKey) {
  return (socialAlertBridgeTypes as readonly string[]).includes(type);
}

export function buildSocialAlertSourceUrl(
  type: SocialAlertTypeKey,
  sourceId: string,
  sourceUrl?: string | null
) {
  const trimmedSourceId = sourceId.trim();
  const trimmedSourceUrl = sourceUrl?.trim();

  if (type === "YOUTUBE" && trimmedSourceId.startsWith("UC")) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(trimmedSourceId)}`;
  }

  if (type === "TWITCH") {
    return `https://www.twitch.tv/${encodeURIComponent(trimmedSourceId)}`;
  }

  if (type === "BLUESKY") {
    return `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(trimmedSourceId)}&filter=posts_no_replies&limit=20`;
  }

  if (type === "REDDIT") {
    if (
      trimmedSourceUrl &&
      !/^https?:\/\/(www\.|old\.)?reddit\.com\//i.test(trimmedSourceUrl)
    ) {
      return trimmedSourceUrl;
    }

    const normalized = trimmedSourceId
      .replace(/^https?:\/\/(www\.)?reddit\.com\//i, "")
      .replace(/^\/+|\/+$/g, "");
    const userMatch = normalized.match(/^(?:u|user)\/(.+)$/i);

    return userMatch
      ? `https://www.reddit.com/user/${userMatch[1]}/submitted/.rss`
      : `https://www.reddit.com/${
          normalized.startsWith("r/") ? normalized : `r/${normalized}`
        }/new/.rss`;
  }

  if (type === "RSS" || type === "PODCAST") {
    return trimmedSourceUrl || trimmedSourceId;
  }

  return trimmedSourceUrl || "";
}

export function isSafePublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLocaleLowerCase();
    const normalizedHostname = hostname.replace(/^\[|\]$/g, "");

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    if (
      normalizedHostname === "localhost" ||
      normalizedHostname.endsWith(".local") ||
      normalizedHostname === "::1" ||
      normalizedHostname.startsWith("fc") ||
      normalizedHostname.startsWith("fd") ||
      normalizedHostname.startsWith("fe80:") ||
      normalizedHostname.startsWith("127.") ||
      normalizedHostname.startsWith("10.") ||
      normalizedHostname.startsWith("192.168.") ||
      normalizedHostname.startsWith("169.254.")
    ) {
      return false;
    }

    const private172 = normalizedHostname.match(/^172\.(\d{1,3})\./);

    return !private172 || Number(private172[1]) < 16 || Number(private172[1]) > 31;
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
    mentionRoleId: optionalSnowflakeSchema.default(null),
    mentionEveryone: z.boolean().default(false),
    messageTemplate: z.string().min(1).max(1_500),
    intervalSeconds: z.coerce.number().int().min(60).max(86_400).default(300),
    maxItemsPerCheck: z.coerce.number().int().min(1).max(5).default(3),
    maxNotificationsPerHour: z.coerce.number().int().min(1).max(60).default(12),
    enabled: z.boolean().default(true)
  })
  .superRefine((alert, context) => {
    const sourceUrl = buildSocialAlertSourceUrl(alert.type, alert.sourceId, alert.sourceUrl);

    if (!isSafePublicHttpUrl(sourceUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceUrl"],
        message: socialAlertNeedsBridge(alert.type)
          ? "此平台需要公開的 RSS、Atom、JSON Feed 或 API bridge URL。"
          : "此社群通知需要有效且可公開存取的來源網址。"
      });
    }

    if (alert.mentionEveryone && alert.mentionRoleId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mentionRoleId"],
        message: "不可同時提及 everyone 與身分組。"
      });
    }
  });

export const socialAlertsUpdateSchema = z
  .object({
    alerts: z.array(socialAlertInputSchema).max(100)
  })
  .superRefine((input, context) => {
    const keys = new Set<string>();
    const ids = new Set<string>();

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

      if (alert.id) {
        if (ids.has(alert.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["alerts", index, "id"],
            message: "同一筆通知來源不可重複提交。"
          });
        }

        ids.add(alert.id);
      }
    }
  });

export type SocialAlertInput = z.infer<typeof socialAlertInputSchema>;

export const ticketSettingsSchema = z.object({
  panelChannelId: optionalSnowflakeSchema.default(null),
  categoryId: optionalSnowflakeSchema.default(null),
  supportRoleIds: z.array(snowflakeSchema).max(20).default([]),
  logChannelId: optionalSnowflakeSchema.default(null),
  panelTitle: z.string().trim().min(1).max(100).default("需要協助嗎？"),
  panelDescription: z.string().trim().min(1).max(1_000).default("點擊下方按鈕建立私人客服單。"),
  ticketWelcomeMessage: z
    .string()
    .trim()
    .min(1)
    .max(1_500)
    .default("{user}，客服團隊會盡快回覆你。"),
  maxOpenPerUser: z.coerce.number().int().min(1).max(5).default(1)
});

export type TicketSettings = z.infer<typeof ticketSettingsSchema>;

export const inviteTrackingSettingsSchema = z.object({
  announcementChannelId: optionalSnowflakeSchema.default(null),
  announcementMessage: z
    .string()
    .trim()
    .min(1)
    .max(1_500)
    .default("{member} 透過 {inviter} 的邀請加入，目前已邀請 {count} 人。"),
  trackBots: z.boolean().default(false)
});

export type InviteTrackingSettings = z.infer<typeof inviteTrackingSettingsSchema>;

const optionalHttpUrlSchema = z
  .union([z.string().url().max(2_048), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

export const embedMessageInputSchema = z
  .object({
    id: z.string().optional(),
    channelId: snowflakeSchema,
    content: z.string().max(2_000).optional().nullable(),
    title: z.string().max(256).optional().nullable(),
    description: z.string().max(4_096).optional().nullable(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#24b47e"),
    url: optionalHttpUrlSchema.default(null),
    imageUrl: optionalHttpUrlSchema.default(null),
    thumbnailUrl: optionalHttpUrlSchema.default(null),
    footerText: z.string().max(2_048).optional().nullable(),
    authorName: z.string().max(256).optional().nullable(),
    enabled: z.boolean().default(true)
  })
  .refine(
    (message) =>
      Boolean(message.content?.trim() || message.title?.trim() || message.description?.trim()),
    {
      message: "至少需要訊息內容、標題或說明其中一項",
      path: ["description"]
    }
  );

export const embedMessagesUpdateSchema = z.object({
  messages: z.array(embedMessageInputSchema).max(50)
});

export type EmbedMessageInput = z.infer<typeof embedMessageInputSchema>;

export const reminderInputSchema = z.object({
  id: z.string().optional(),
  channelId: snowflakeSchema,
  message: z.string().trim().min(1).max(2_000),
  nextRunAt: z.coerce.date(),
  intervalSeconds: z.coerce.number().int().min(60).max(31_536_000).optional().nullable(),
  enabled: z.boolean().default(true)
});

export const remindersUpdateSchema = z.object({
  reminders: z.array(reminderInputSchema).max(100)
});

export type ReminderInput = z.infer<typeof reminderInputSchema>;

export const starboardSettingsSchema = z.object({
  channelId: optionalSnowflakeSchema.default(null),
  emoji: z.string().trim().min(1).max(64).default("⭐"),
  threshold: z.coerce.number().int().min(1).max(100).default(3),
  ignoredChannelIds: z.array(snowflakeSchema).max(100).default([]),
  allowSelfStar: z.boolean().default(false),
  removeBelowThreshold: z.boolean().default(true)
});

export type StarboardSettings = z.infer<typeof starboardSettingsSchema>;

export const achievementTriggers = ["MESSAGE_COUNT", "LEVEL", "INVITE_COUNT"] as const;
export type AchievementTriggerKey = (typeof achievementTriggers)[number];

export const achievementTriggerLabels: Record<AchievementTriggerKey, string> = {
  MESSAGE_COUNT: "訊息數量",
  LEVEL: "等級",
  INVITE_COUNT: "邀請人數"
};

export const achievementInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  icon: z.string().trim().max(64).optional().nullable(),
  trigger: z.enum(achievementTriggers),
  threshold: z.coerce.number().int().min(1).max(10_000_000),
  rewardRoleId: optionalSnowflakeSchema.default(null),
  enabled: z.boolean().default(true)
});

export const achievementSettingsSchema = z
  .object({
    announcementChannelId: optionalSnowflakeSchema.default(null),
    announcementMessage: z
      .string()
      .trim()
      .min(1)
      .max(1_500)
      .default("🎉 {user} 解鎖了成就 **{achievement}**！"),
    achievements: z.array(achievementInputSchema).max(100).default([])
  })
  .superRefine((settings, context) => {
    const names = new Set<string>();

    settings.achievements.forEach((achievement, index) => {
      const normalizedName = achievement.name.toLocaleLowerCase();

      if (names.has(normalizedName)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "成就名稱不可重複",
          path: ["achievements", index, "name"]
        });
      }

      names.add(normalizedName);
    });
  });

export type AchievementInput = z.infer<typeof achievementInputSchema>;
export type AchievementSettings = z.infer<typeof achievementSettingsSchema>;

export const birthdaySettingsSchema = z.object({
  announcementChannelId: optionalSnowflakeSchema.default(null),
  announcementMessage: z
    .string()
    .trim()
    .min(1)
    .max(1_500)
    .default("🎂 今天是 {user} 的生日，祝你生日快樂！"),
  timeZone: z.string().trim().refine(isValidTimeZone, "時區格式不正確").default("Asia/Taipei"),
  upcomingDays: z.coerce.number().int().min(1).max(90).default(30)
});

export type BirthdaySettings = z.infer<typeof birthdaySettingsSchema>;

export const serverStatTypes = [
  "MEMBER_COUNT",
  "HUMAN_COUNT",
  "BOT_COUNT",
  "ROLE_COUNT",
  "TEXT_CHANNEL_COUNT",
  "VOICE_CHANNEL_COUNT"
] as const;

export type ServerStatTypeKey = (typeof serverStatTypes)[number];

export const serverStatTypeLabels: Record<ServerStatTypeKey, string> = {
  MEMBER_COUNT: "總成員數",
  HUMAN_COUNT: "真人成員數",
  BOT_COUNT: "機器人數",
  ROLE_COUNT: "身分組數",
  TEXT_CHANNEL_COUNT: "文字頻道數",
  VOICE_CHANNEL_COUNT: "語音頻道數"
};

export const defaultServerStatTemplates: Record<ServerStatTypeKey, string> = {
  MEMBER_COUNT: "成員：{count}",
  HUMAN_COUNT: "真人：{count}",
  BOT_COUNT: "機器人：{count}",
  ROLE_COUNT: "身分組：{count}",
  TEXT_CHANNEL_COUNT: "文字頻道：{count}",
  VOICE_CHANNEL_COUNT: "語音頻道：{count}"
};

export const serverStatChannelInputSchema = z.object({
  id: z.string().optional(),
  type: z.enum(serverStatTypes),
  template: z.string().trim().min(1).max(100),
  categoryId: optionalSnowflakeSchema.default(null),
  enabled: z.boolean().default(true)
});

export const serverStatsUpdateSchema = z
  .object({
    channels: z.array(serverStatChannelInputSchema).max(serverStatTypes.length)
  })
  .superRefine((settings, context) => {
    const types = new Set<ServerStatTypeKey>();

    settings.channels.forEach((channel, index) => {
      if (types.has(channel.type)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "每種伺服器統計只能設定一次",
          path: ["channels", index, "type"]
        });
      }

      types.add(channel.type);
    });
  });

export type ServerStatChannelInput = z.infer<typeof serverStatChannelInputSchema>;

export const temporaryVoiceSettingsSchema = z.object({
  lobbyChannelId: optionalSnowflakeSchema.default(null),
  categoryId: optionalSnowflakeSchema.default(null),
  nameTemplate: z.string().trim().min(1).max(100).default("{username} 的語音房"),
  userLimit: z.coerce.number().int().min(0).max(99).default(0),
  bitrate: z.coerce.number().int().min(8_000).max(384_000).default(64_000)
});

export type TemporaryVoiceSettings = z.infer<typeof temporaryVoiceSettingsSchema>;

const integrationKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const aiAssistantSettingsSchema = z.object({
  personaName: z.string().trim().min(1).max(80).default("Hydrava"),
  systemPrompt: z
    .string()
    .trim()
    .min(20)
    .max(4_000)
    .default("你是這個 Discord 伺服器的 Hydrava AI 助理。請使用繁體中文，回答要友善、準確且簡潔。"),
  channelIds: z.array(snowflakeSchema).max(20).default([]),
  mentionOnly: z.boolean().default(true),
  maxContextMessages: z.coerce.number().int().min(1).max(20).default(8),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  dailyRequestLimit: z.coerce.number().int().min(1).max(1_000).default(100),
  maxResponseCharacters: z.coerce.number().int().min(100).max(4_000).default(1_800)
});

export type AiAssistantSettings = z.infer<typeof aiAssistantSettingsSchema>;

export const membershipPlanInputSchema = z.object({
  key: integrationKeySchema,
  name: z.string().trim().min(1).max(80),
  roleId: snowflakeSchema,
  privateChannelIds: z.array(snowflakeSchema).max(20).default([]),
  enabled: z.boolean().default(true)
});

export type MembershipPlanInput = z.infer<typeof membershipPlanInputSchema>;

export const membershipSettingsSchema = z
  .object({
    announcementChannelId: optionalSnowflakeSchema.default(null),
    gracePeriodDays: z.coerce.number().int().min(0).max(30).default(3),
    removeRoleOnExpiry: z.boolean().default(true),
    plans: z.array(membershipPlanInputSchema).max(20).default([])
  })
  .superRefine((settings, context) => {
    const keys = new Set<string>();

    settings.plans.forEach((plan, index) => {
      if (keys.has(plan.key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "會員方案代碼不可重複",
          path: ["plans", index, "key"]
        });
      }
      keys.add(plan.key);
    });
  });

export type MembershipSettings = z.infer<typeof membershipSettingsSchema>;

export const membershipEntitlementStatuses = [
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "EXPIRED"
] as const;

export const membershipWebhookPayloadSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  userId: snowflakeSchema,
  planKey: integrationKeySchema,
  status: z.enum(membershipEntitlementStatuses),
  externalId: z.string().trim().min(1).max(200).nullable().default(null),
  occurredAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().default(null)
});

export type MembershipWebhookPayload = z.infer<typeof membershipWebhookPayloadSchema>;

export const web3TokenStandards = ["ERC721", "ERC1155"] as const;

export const web3CollectionInputSchema = z
  .object({
    key: integrationKeySchema,
    name: z.string().trim().min(1).max(80),
    chainId: z.coerce.number().int().positive(),
    contractAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
    standard: z.enum(web3TokenStandards),
    tokenId: z.string().trim().regex(/^\d+$/).nullable().default(null),
    minimumBalance: z.coerce.number().int().min(1).max(1_000_000).default(1),
    roleId: snowflakeSchema,
    privateChannelIds: z.array(snowflakeSchema).max(20).default([]),
    enabled: z.boolean().default(true)
  })
  .superRefine((collection, context) => {
    if (collection.standard === "ERC1155" && !collection.tokenId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ERC-1155 收藏必須指定 Token ID",
        path: ["tokenId"]
      });
    }
  });

export type Web3CollectionInput = z.infer<typeof web3CollectionInputSchema>;

export const web3SettingsSchema = z
  .object({
    announcementChannelId: optionalSnowflakeSchema.default(null),
    verificationMessage: z
      .string()
      .trim()
      .min(1)
      .max(1_000)
      .default("✅ {user} 已通過 {collection} 持有資格驗證。"),
    recheckHours: z.coerce.number().int().min(1).max(168).default(24),
    collections: z.array(web3CollectionInputSchema).max(20).default([])
  })
  .superRefine((settings, context) => {
    const keys = new Set<string>();

    settings.collections.forEach((collection, index) => {
      if (keys.has(collection.key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Web3 收藏代碼不可重複",
          path: ["collections", index, "key"]
        });
      }
      keys.add(collection.key);
    });
  });

export type Web3Settings = z.infer<typeof web3SettingsSchema>;

export const web3WalletAddressSchema = z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/);
export const web3WalletSignatureSchema = z.string().trim().regex(/^0x[a-fA-F0-9]{130}$/);

export function parseWeb3RpcUrls(value?: string) {
  if (!value) {
    return new Map<number, string>();
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return new Map(
      Object.entries(parsed)
        .filter(
          (entry): entry is [string, string] =>
            /^\d+$/.test(entry[0]) &&
            typeof entry[1] === "string" &&
            /^https?:\/\//.test(entry[1])
        )
        .map(([chainId, url]) => [Number(chainId), url])
    );
  } catch {
    return new Map<number, string>();
  }
}

export const automationTriggers = [
  "MESSAGE_CREATE",
  "REACTION_ADD",
  "MEMBER_JOIN",
  "MEMBER_ROLE_UPDATE"
] as const;

export type AutomationTriggerKey = (typeof automationTriggers)[number];

export const automationTriggerLabels: Record<AutomationTriggerKey, string> = {
  MESSAGE_CREATE: "訊息建立",
  REACTION_ADD: "新增反應",
  MEMBER_JOIN: "成員加入",
  MEMBER_ROLE_UPDATE: "成員身分組變更"
};

export const automationRoleChanges = ["ANY", "ADDED", "REMOVED"] as const;

export const automationTriggerConfigSchema = z.object({
  emoji: z.string().trim().max(64).optional().nullable().default(null),
  roleId: optionalSnowflakeSchema.default(null),
  roleChange: z.enum(automationRoleChanges).default("ANY")
});

export const automationConditionsSchema = z.object({
  channelIds: z.array(snowflakeSchema).max(100).default([]),
  requiredRoleIds: z.array(snowflakeSchema).max(100).default([]),
  excludedRoleIds: z.array(snowflakeSchema).max(100).default([]),
  keywords: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  keywordMode: z.enum(["ANY", "ALL"]).default("ANY"),
  activeDays: z.array(z.coerce.number().int().min(0).max(6)).max(7).default([]),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable()
    .default(null),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .nullable()
    .default(null),
  timeZone: z.string().trim().refine(isValidTimeZone, "時區格式無效").default("Asia/Taipei")
});

const automationSendMessageActionSchema = z.object({
  type: z.literal("SEND_MESSAGE"),
  channelId: optionalSnowflakeSchema.default(null),
  content: z.string().trim().min(1).max(2_000)
});

const automationAddRoleActionSchema = z.object({
  type: z.literal("ADD_ROLE"),
  roleId: snowflakeSchema
});

const automationDeleteMessageActionSchema = z.object({
  type: z.literal("DELETE_MESSAGE")
});

const automationTimeoutActionSchema = z.object({
  type: z.literal("TIMEOUT_MEMBER"),
  durationSeconds: z.coerce.number().int().min(60).max(2_419_200).default(600),
  reason: z.string().trim().max(500).optional().nullable().default(null)
});

const automationKickActionSchema = z.object({
  type: z.literal("KICK_MEMBER"),
  reason: z.string().trim().max(500).optional().nullable().default(null)
});

const automationBanActionSchema = z.object({
  type: z.literal("BAN_MEMBER"),
  reason: z.string().trim().max(500).optional().nullable().default(null),
  deleteMessageSeconds: z.coerce.number().int().min(0).max(604_800).default(0)
});

export const automationActionSchema = z.discriminatedUnion("type", [
  automationSendMessageActionSchema,
  automationAddRoleActionSchema,
  automationDeleteMessageActionSchema,
  automationTimeoutActionSchema,
  automationKickActionSchema,
  automationBanActionSchema
]);

export const automationActionTypes = [
  "SEND_MESSAGE",
  "ADD_ROLE",
  "DELETE_MESSAGE",
  "TIMEOUT_MEMBER",
  "KICK_MEMBER",
  "BAN_MEMBER"
] as const;

export type AutomationActionTypeKey = (typeof automationActionTypes)[number];

export const automationActionLabels: Record<AutomationActionTypeKey, string> = {
  SEND_MESSAGE: "傳送訊息",
  ADD_ROLE: "給予身分組",
  DELETE_MESSAGE: "刪除訊息",
  TIMEOUT_MEMBER: "禁言成員",
  KICK_MEMBER: "踢出成員",
  BAN_MEMBER: "封鎖成員"
};

export const automationRuleInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional().nullable().default(null),
    trigger: z.enum(automationTriggers),
    triggerConfig: automationTriggerConfigSchema.default({}),
    conditions: automationConditionsSchema.default({}),
    actions: z.array(automationActionSchema).min(1).max(10),
    position: z.coerce.number().int().min(0).max(10_000).default(0),
    enabled: z.boolean().default(true),
    stopProcessing: z.boolean().default(false),
    cooldownSeconds: z.coerce.number().int().min(0).max(604_800).default(0)
  })
  .superRefine((rule, context) => {
    if (
      (rule.trigger === "MEMBER_JOIN" || rule.trigger === "MEMBER_ROLE_UPDATE") &&
      rule.actions.some((action) => action.type === "DELETE_MESSAGE")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actions"],
        message: "成員事件沒有可刪除的訊息"
      });
    }

    if (
      (rule.trigger === "MEMBER_JOIN" || rule.trigger === "MEMBER_ROLE_UPDATE") &&
      rule.actions.some((action) => action.type === "SEND_MESSAGE" && !action.channelId)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actions"],
        message: "成員事件的傳送訊息動作必須指定頻道"
      });
    }

    if (
      rule.trigger === "MEMBER_ROLE_UPDATE" &&
      rule.triggerConfig.roleId &&
      rule.actions.some(
        (action) =>
          action.type === "ADD_ROLE" && action.roleId === rule.triggerConfig.roleId
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actions"],
        message: "不可在身分組觸發器中再次給予同一身分組"
      });
    }
  });

export const automationRulesUpdateSchema = z
  .object({
    rules: z.array(automationRuleInputSchema).max(100)
  })
  .superRefine((input, context) => {
    const names = new Set<string>();
    const ids = new Set<string>();

    input.rules.forEach((rule, index) => {
      const name = rule.name.toLocaleLowerCase();

      if (names.has(name)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules", index, "name"],
          message: "自動化規則名稱不可重複"
        });
      }

      names.add(name);

      if (rule.id) {
        if (ids.has(rule.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rules", index, "id"],
            message: "同一筆自動化規則不可重複提交"
          });
        }

        ids.add(rule.id);
      }
    });
  });

export const automationTestSchema = z.object({
  rule: automationRuleInputSchema,
  sample: z
    .object({
      content: z.string().max(4_000).default(""),
      channelId: optionalSnowflakeSchema.default(null),
      roleIds: z.array(snowflakeSchema).max(100).default([]),
      occurredAt: z.coerce.date().default(() => new Date())
    })
    .default({})
});

export type AutomationTriggerConfig = z.infer<typeof automationTriggerConfigSchema>;
export type AutomationConditions = z.infer<typeof automationConditionsSchema>;
export type AutomationAction = z.infer<typeof automationActionSchema>;
export type AutomationRuleInput = z.infer<typeof automationRuleInputSchema>;
export type AutomationTestInput = z.infer<typeof automationTestSchema>;

export type AutomationConditionSample = {
  content: string;
  channelId: string | null;
  roleIds: string[];
  occurredAt: Date;
};

export function evaluateAutomationConditions(
  conditions: AutomationConditions,
  sample: AutomationConditionSample
) {
  const failures: string[] = [];

  if (
    conditions.channelIds.length > 0 &&
    (!sample.channelId || !conditions.channelIds.includes(sample.channelId))
  ) {
    failures.push("頻道條件不符合");
  }

  if (
    conditions.requiredRoleIds.length > 0 &&
    !conditions.requiredRoleIds.every((roleId) => sample.roleIds.includes(roleId))
  ) {
    failures.push("缺少必要身分組");
  }

  if (conditions.excludedRoleIds.some((roleId) => sample.roleIds.includes(roleId))) {
    failures.push("包含排除的身分組");
  }

  if (conditions.keywords.length > 0) {
    const content = sample.content.toLocaleLowerCase();
    const matches = conditions.keywords.map((keyword) =>
      content.includes(keyword.toLocaleLowerCase())
    );
    const keywordMatched =
      conditions.keywordMode === "ALL" ? matches.every(Boolean) : matches.some(Boolean);

    if (!keywordMatched) {
      failures.push("關鍵字條件不符合");
    }
  }

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: conditions.timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(sample.occurredAt);
  const values = new Map(dateParts.map((part) => [part.type, part.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    values.get("weekday") ?? ""
  );
  const currentTime = `${values.get("hour") ?? "00"}:${values.get("minute") ?? "00"}`;

  if (conditions.activeDays.length > 0 && !conditions.activeDays.includes(weekday)) {
    failures.push("星期條件不符合");
  }

  if (conditions.startTime && conditions.endTime) {
    const timeMatched =
      conditions.startTime <= conditions.endTime
        ? currentTime >= conditions.startTime && currentTime <= conditions.endTime
        : currentTime >= conditions.startTime || currentTime <= conditions.endTime;

    if (!timeMatched) {
      failures.push("時間條件不符合");
    }
  } else if (conditions.startTime && currentTime < conditions.startTime) {
    failures.push("尚未到規則開始時間");
  } else if (conditions.endTime && currentTime > conditions.endTime) {
    failures.push("已超過規則結束時間");
  }

  return {
    matched: failures.length === 0,
    failures
  };
}

export function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
