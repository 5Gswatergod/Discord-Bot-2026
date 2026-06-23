import { z } from "zod";

const optionalString = z.preprocess((value) => {
  if (value === "") {
    return undefined;
  }

  return value;
}, z.string().optional());

export const sharedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379")
});

export const botEnvSchema = sharedEnvSchema.extend({
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_TEST_GUILD_ID: optionalString,
  TWITCH_CLIENT_ID: optionalString,
  TWITCH_ACCESS_TOKEN: optionalString,
  REDDIT_CLIENT_ID: optionalString,
  REDDIT_CLIENT_SECRET: optionalString,
  REDDIT_USER_AGENT: optionalString,
  AI_API_BASE_URL: optionalString.pipe(z.string().url().optional()),
  AI_API_KEY: optionalString,
  AI_MODEL: optionalString,
  WEB3_RPC_URLS_JSON: optionalString,
  LAVALINK_HOST: z.string().min(1).default("localhost"),
  LAVALINK_PORT: z.coerce.number().int().positive().max(65_535).default(2333),
  LAVALINK_PASSWORD: optionalString,
  SPOTIFY_CLIENT_ID: optionalString,
  SPOTIFY_CLIENT_SECRET: optionalString,
  YTDLP_PATH: z.string().min(1).default("yt-dlp"),
  MUSIC_TEMP_DIR: z.string().min(1).default(".cache/music"),
  MUSIC_LAVALINK_LOCAL_PREFIX: z.string().min(1).default("/opt/Lavalink/music"),
  MUSIC_DOWNLOAD_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  MUSIC_DOWNLOAD_TIMEOUT_SECONDS: z.coerce.number().int().min(30).max(900).default(180),
  MUSIC_MAX_FILE_MB: z.coerce.number().int().min(16).max(2_048).default(512),
  MUSIC_MAX_TEMP_MB: z.coerce.number().int().min(64).max(16_384).default(2_048),
  MUSIC_MAX_DURATION_SECONDS: z.coerce.number().int().min(60).max(86_400).default(21_600),
  MUSIC_ORPHAN_MAX_AGE_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  GUILD_SYNC_LIMIT: z.coerce.number().int().positive().default(100)
});

export const dashboardEnvSchema = sharedEnvSchema.extend({
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_BOT_PERMISSIONS: z.coerce.number().int().positive().default(8),
  MEMBERSHIP_WEBHOOK_SECRET: optionalString,
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),
  APP_URL: z.string().url().default("http://localhost:3000")
});

export type BotEnv = z.infer<typeof botEnvSchema>;
export type DashboardEnv = z.infer<typeof dashboardEnvSchema>;
