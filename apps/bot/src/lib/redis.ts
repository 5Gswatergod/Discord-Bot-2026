import Redis from "ioredis";

import { env } from "../env";
import { logger } from "./logger";

export async function createRedisClient() {
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3
  });

  redis.on("error", (error) => {
    logger.warn("Redis client error", {
      message: error.message
    });
  });

  await redis.connect();
  return redis;
}
