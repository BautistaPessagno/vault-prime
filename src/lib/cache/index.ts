import type { KeyCache } from "./keyCache";
import { memoryCache } from "./memoryCache";

export type { KeyCache } from "./keyCache";
export { CACHE_CONFIG } from "./config";

let cacheInstance: KeyCache | null = null;

export function getKeyCache(): KeyCache {
  if (cacheInstance) {
    return cacheInstance;
  }

  if (process.env.REDIS_URL) {
    // Dynamically import Redis cache only when needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { redisCache } = require("./redisCache");
    cacheInstance = redisCache as KeyCache;
  } else {
    cacheInstance = memoryCache;
  }

  return cacheInstance!;
}
