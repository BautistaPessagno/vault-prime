"use server";
import * as argon2 from "argon2";
import crypto from "crypto";

const algorithm = "aes-256-gcm";

export async function hash(password: string) {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
  });
}

export async function generateSalt(): Promise<string> {
  return crypto.randomBytes(32).toString("hex");
}

export async function generateIv(): Promise<string> {
  return crypto.randomBytes(12).toString("hex");
}

export async function verify(password: string, hashedPassword: string) {
  return await argon2.verify(hashedPassword, password);
}

// generates AES-256-GCM key using Argon2 salt
export async function generateKey(password: string, salt: string) {
  const key = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    salt: Buffer.from(salt, "hex"),
    hashLength: 32,
    raw: true,
  });
  return key.toString("hex");
}

export async function encrypt(password: string, key: string, iv: string) {
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "hex"),
  );
  let encrypted = cipher.update(password, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();
  return encrypted + ":" + tag.toString("base64");
}

export async function decrypt(
  encryptedPassword: string,
  key: string,
  iv: string,
) {
  const [content, tag] = encryptedPassword.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  let decrypted = decipher.update(content, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
