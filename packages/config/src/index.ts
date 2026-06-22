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
  GUILD_SYNC_LIMIT: z.coerce.number().int().positive().default(100)
});

export const dashboardEnvSchema = sharedEnvSchema.extend({
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_BOT_PERMISSIONS: z.coerce.number().int().positive().default(8),
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),
  APP_URL: z.string().url().default("http://localhost:3000")
});

export type BotEnv = z.infer<typeof botEnvSchema>;
export type DashboardEnv = z.infer<typeof dashboardEnvSchema>;
