import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";

/**
 * Generate a cryptographically secure session ID
 * 32 bytes = 256 bits of entropy, hex-encoded to 64 chars
 */
export function generateSessionId(): string {
  return bytesToHex(randomBytes(32));
}
