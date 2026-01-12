export const CACHE_CONFIG = {
  ttlSeconds: parseInt(process.env.KEY_CACHE_TTL || "900", 10), // 15 minutes default
  maxMemoryEntries: 10000,
};
