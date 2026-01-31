import { getKeyCache } from "@/src/lib/cache";

export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  keyPrefix: string;
}

export const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
  keyPrefix: "ratelimit:",
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = defaultRateLimitConfig
): Promise<RateLimitResult> {
  const cache = getKeyCache();
  const key = `${config.keyPrefix}${identifier}`;
  const now = Date.now();

  const data = await cache.get(key);

  if (!data) {
    // First request - allow it
    const resetAt = now + config.windowMs;
    await cache.set(
      key,
      JSON.stringify({ count: 1, resetAt }),
      Math.ceil(config.windowMs / 1000)
    );
    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetAt,
    };
  }

  const parsed = JSON.parse(data) as { count: number; resetAt: number };

  if (now >= parsed.resetAt) {
    // Window expired - reset
    const resetAt = now + config.windowMs;
    await cache.set(
      key,
      JSON.stringify({ count: 1, resetAt }),
      Math.ceil(config.windowMs / 1000)
    );
    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetAt,
    };
  }

  // Still in window
  const newCount = parsed.count + 1;
  const allowed = newCount <= config.maxAttempts;

  await cache.set(
    key,
    JSON.stringify({ count: newCount, resetAt: parsed.resetAt }),
    Math.ceil((parsed.resetAt - now) / 1000)
  );

  return {
    allowed,
    remaining: Math.max(0, config.maxAttempts - newCount),
    resetAt: parsed.resetAt,
  };
}

export async function resetRateLimit(
  identifier: string,
  keyPrefix: string = "ratelimit:"
): Promise<void> {
  const cache = getKeyCache();
  const key = `${keyPrefix}${identifier}`;
  await cache.delete(key);
}
