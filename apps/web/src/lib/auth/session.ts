import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";

/**
 * Prefixed with userId so we can invalidate every session for a given user
 * (password change, future account-wide revoke) via cache.deleteByPrefix.
 */
export function generateSessionId(userId: string): string {
  return `${userId}:${bytesToHex(randomBytes(32))}`;
}
