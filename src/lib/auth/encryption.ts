"use server";
import * as argon2 from "argon2";
import { randomBytes, bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

// ----------------------------- Argon2 hash ------------------------------------------------
//
export async function hash(password: string) {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
  });
}

export async function verify(password: string, hashedPassword: string) {
  return await argon2.verify(hashedPassword, password);
}

// ----------------------------- derivation key ------------------------------------------------

// este hash se va a usar como key para el aes-256-gcm
//el payloead es el master key y el salt es la password
export async function generateKey(payload: string, salt: string) {
  const enc = new TextEncoder();
  const k = hkdf(
    sha256,
    enc.encode(payload),
    enc.encode(salt),
    new Uint8Array(0),
    32,
  );
  return bytesToHex(k);
}

// ----------------------------- aes-256-gcm key ------------------------------------------------

export async function generateSalt() {
  return bytesToHex(randomBytes(32));
}

export async function generateIv() {
  return bytesToHex(randomBytes(24));
}

export async function encrypt(key: string, nonce: string, data: string) {
  const keyBytes = hexToBytes(key);
  const nonceBytes = hexToBytes(nonce);
  const aes = gcm(keyBytes, nonceBytes);
  const dataBytes = new TextEncoder().encode(data);
  const encrypted = aes.encrypt(dataBytes);
  return bytesToHex(encrypted);
}

export async function decrypt(key: string, nonce: string, ciphertext: string) {
  const keyBytes = hexToBytes(key);
  const nonceBytes = hexToBytes(nonce);
  const aes = gcm(keyBytes, nonceBytes);
  const ciphertextBytes = hexToBytes(ciphertext);
  const decrypted = aes.decrypt(ciphertextBytes);
  return new TextDecoder().decode(decrypted);
}
