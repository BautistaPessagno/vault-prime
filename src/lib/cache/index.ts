import type { KeyCache } from "./keyCache";
import { memoryCache } from "./memoryCache";

export type { KeyCache } from "./keyCache";
export { CACHE_CONFIG } from "./config";

// Use globalThis to persist cache across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __keyCacheInstance: KeyCache | undefined;
}

export function getKeyCache(): KeyCache {
  if (globalThis.__keyCacheInstance) {
    return globalThis.__keyCacheInstance;
  }

  if (process.env.REDIS_URL) {
    // Dynamically import Redis cache only when needed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { redisCache } = require("./redisCache");
    globalThis.__keyCacheInstance = redisCache as KeyCache;
  } else {
    globalThis.__keyCacheInstance = memoryCache;
  }

  return globalThis.__keyCacheInstance!;
}
