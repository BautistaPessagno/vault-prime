import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { gcm } from "@noble/ciphers/aes";

/**
 * Derive a 32-byte stretched key from master key hash + password using HKDF-SHA256.
 * Must produce the same output as apps/web/src/lib/auth/encryption.ts:deriveKey()
 */
export function deriveKey(masterKeyHash: string, password: string): string {
  const enc = new TextEncoder();
  const k = hkdf(
    sha256,
    enc.encode(masterKeyHash),
    enc.encode(password),
    enc.encode("vault-prime-derivation"),
    32,
  );
  return bytesToHex(k);
}

/**
 * Decrypt a value in "nonce:ciphertext" hex format using AES-256-GCM.
 * Must produce the same output as apps/web/src/lib/entries/crypto.ts:decryptValue()
 */
export function decryptValue(encoded: string, key: string): string {
  if (!encoded) return "";
  const [nonce, ciphertext] = encoded.split(":");
  if (!nonce || !ciphertext) {
    throw new Error("Malformed encrypted value: expected nonce:ciphertext format");
  }
  const keyBytes = hexToBytes(key);
  const nonceBytes = hexToBytes(nonce);
  const ciphertextBytes = hexToBytes(ciphertext);
  const aes = gcm(keyBytes, nonceBytes);
  const decrypted = aes.decrypt(ciphertextBytes);
  return new TextDecoder().decode(decrypted);
}
