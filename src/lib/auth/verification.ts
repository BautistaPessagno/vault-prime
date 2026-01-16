"use server";

import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { emailVerificationCodesTable } from "@/src/db/schema";
import { db } from "@/src/db";

async function generateVerificationCode() {
  const bytes = randomBytes(32);
  const num = (bytes[0] << 16) | (bytes[1] << 8) | (bytes[2] << 8) | bytes[2]; // convert to 32-bit integer
  const code = (num % 900000) + 100000;

  return code.toString();
}

export async function generateAuthCode(id: string) {
  const verification_code = await generateVerificationCode();

  try {
    await db
      .insert(emailVerificationCodesTable)
      .values({
        user_id: id,
        code: verification_code,
        expires_at: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
      })
      .returning({ id: emailVerificationCodesTable.id });
  } catch (error) {
    console.error("[Auth Signup] Insert error:", error);
    return null;
  }

  return verification_code;
}
