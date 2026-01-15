"use server";

import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { emailVerificationTokensTable } from "@/src/db/schema";
import { db } from "@/src/db";

async function generateVerificationToken() {
  return bytesToHex(randomBytes(32));
}

export async function generateAuthToken(id: string) {
  const verification_token = await generateVerificationToken();

  try {
    await db
      .insert(emailVerificationTokensTable)
      .values({
        user_id: id,
        token: verification_token,
        expires_at: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
      })
      .returning({ id: emailVerificationTokensTable.id });
  } catch (error) {
    console.error("[Auth Signup] Insert error:", error);
    return null;
  }

  return verification_token;
}
