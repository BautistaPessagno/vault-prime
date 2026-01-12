import type { KeyCache } from "./keyCache";
import { Redis } from "ioredis";

let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL environment variable is not set");
    }
    redis = new Redis(url);
  }
  return redis;
}

const KEY_PREFIX = "vault:ek:";

export const redisCache: KeyCache = {
  async set(sessionId: string, encryptionKey: string, ttlSeconds: number): Promise<void> {
    const client = getRedisClient();
    await client.setex(`${KEY_PREFIX}${sessionId}`, ttlSeconds, encryptionKey);
  },

  async get(sessionId: string): Promise<string | null> {
    const client = getRedisClient();
    return client.get(`${KEY_PREFIX}${sessionId}`);
  },

  async delete(sessionId: string): Promise<void> {
    const client = getRedisClient();
    await client.del(`${KEY_PREFIX}${sessionId}`);
  },

  async refresh(sessionId: string, ttlSeconds: number): Promise<boolean> {
    const client = getRedisClient();
    const result = await client.expire(`${KEY_PREFIX}${sessionId}`, ttlSeconds);
    return result === 1;
  },
};
