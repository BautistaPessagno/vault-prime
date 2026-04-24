import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { gcm } from "@noble/ciphers/aes.js";

const key = bytesToHex(randomBytes(32));
const plaintext = "vault-prime-nonce-backcompat";

function enc(key, nonceBytes, data) {
  const k = Uint8Array.from(Buffer.from(key, "hex"));
  const aes = gcm(k, nonceBytes);
  return bytesToHex(aes.encrypt(new TextEncoder().encode(data)));
}
function dec(key, nonceHex, ctHex) {
  const k = Uint8Array.from(Buffer.from(key, "hex"));
  const n = Uint8Array.from(Buffer.from(nonceHex, "hex"));
  const aes = gcm(k, n);
  return new TextDecoder().decode(aes.decrypt(Uint8Array.from(Buffer.from(ctHex, "hex"))));
}

const n12 = randomBytes(12);
const ct12 = enc(key, n12, plaintext);
const out12 = dec(key, bytesToHex(n12), ct12);
console.log("12-byte nonce round-trip:", out12 === plaintext ? "PASS" : "FAIL", `(nonce=${bytesToHex(n12).length/2} bytes)`);

const n24 = randomBytes(24);
const ct24 = enc(key, n24, plaintext);
const out24 = dec(key, bytesToHex(n24), ct24);
console.log("24-byte nonce round-trip:", out24 === plaintext ? "PASS" : "FAIL", `(nonce=${bytesToHex(n24).length/2} bytes)`);

const mismatched = (() => {
  try {
    dec(key, bytesToHex(randomBytes(12)), ct24);
    return "DECRYPTED (unexpected)";
  } catch (e) { return "rejected (expected): " + e.message; }
})();
console.log("12-byte-nonce used to decrypt 24-byte-nonce ct:", mismatched);
