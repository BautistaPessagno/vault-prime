import type { KeyCache } from "./keyCache";
import { CACHE_CONFIG } from "./config";

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupExpired, 60_000);

function enforceMaxEntries() {
  if (cache.size > CACHE_CONFIG.maxMemoryEntries) {
    // Remove oldest entries (first inserted)
    const toRemove = cache.size - CACHE_CONFIG.maxMemoryEntries;
    const keys = Array.from(cache.keys()).slice(0, toRemove);
    for (const key of keys) {
      cache.delete(key);
    }
  }
}

export const memoryCache: KeyCache = {
  async set(sessionId: string, encryptionKey: string, ttlSeconds: number): Promise<void> {
    cache.set(sessionId, {
      value: encryptionKey,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    enforceMaxEntries();
  },

  async get(sessionId: string): Promise<string | null> {
    const entry = cache.get(sessionId);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      cache.delete(sessionId);
      return null;
    }
    return entry.value;
  },

  async delete(sessionId: string): Promise<void> {
    cache.delete(sessionId);
  },

  async refresh(sessionId: string, ttlSeconds: number): Promise<boolean> {
    const entry = cache.get(sessionId);
    if (!entry || entry.expiresAt <= Date.now()) {
      return false;
    }
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    return true;
  },
};
