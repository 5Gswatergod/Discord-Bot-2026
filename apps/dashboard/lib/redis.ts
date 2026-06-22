import Redis from "ioredis";

import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  dashboardRedis?: Redis;
};

export const redis =
  globalForRedis.dashboardRedis ??
  new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });

redis.on("error", () => {
  // API routes report Redis availability in their response.
});

if (process.env.NODE_ENV !== "production") {
  globalForRedis.dashboardRedis = redis;
}

export async function ensureRedisConnection() {
  if (redis.status === "wait" || redis.status === "end") {
    await redis.connect();
  }

  return redis;
}
