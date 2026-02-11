"use server";

import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { emailVerificationCodesTable } from "@/src/db/schema";
import { db } from "@/src/db";
import { eq, sql, and, gt } from "drizzle-orm";

const MAX_VERIFICATION_ATTEMPTS = 3;

function hashCode(code: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(code)));
}

async function generateVerificationCode() {
  const bytes = randomBytes(32);
  // Fixed: bytes[2] was used twice in original, now correctly using bytes[2] once
  const num = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  const code = (num % 900000) + 100000;

  return code.toString();
}

export async function generateAuthCode(id: string) {
  const verification_code = await generateVerificationCode();
  const codeHash = hashCode(verification_code);

  try {
    await db
      .insert(emailVerificationCodesTable)
      .values({
        user_id: id,
        code_hash: codeHash,
        expires_at: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
      })
      .returning({ id: emailVerificationCodesTable.id });
  } catch (error) {
    console.error("[Auth Signup] Insert error:", error instanceof Error ? error.message : "unknown");
    return null;
  }

  return verification_code;
}

interface VerifyCodeResult {
  valid: boolean;
  userId?: string;
  error?: "invalid" | "expired" | "max_attempts" | "db";
}

export async function verifyCode(
  userId: string,
  code: string
): Promise<VerifyCodeResult> {
  const codeHash = hashCode(code);

  try {
    // Find verification code for user that hasn't expired
    const rows = await db
      .select({
        id: emailVerificationCodesTable.id,
        code_hash: emailVerificationCodesTable.code_hash,
        expires_at: emailVerificationCodesTable.expires_at,
        attempts: emailVerificationCodesTable.attempts,
      })
      .from(emailVerificationCodesTable)
      .where(
        and(
          eq(emailVerificationCodesTable.user_id, userId),
          gt(emailVerificationCodesTable.expires_at, new Date())
        )
      )
      .orderBy(emailVerificationCodesTable.created_at)
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { valid: false, error: "invalid" };
    }

    // Check max attempts
    if (row.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return { valid: false, error: "max_attempts" };
    }

    // Increment attempts
    await db
      .update(emailVerificationCodesTable)
      .set({ attempts: sql`${emailVerificationCodesTable.attempts} + 1` })
      .where(eq(emailVerificationCodesTable.id, row.id));

    // Check if max attempts reached after increment
    if (row.attempts + 1 >= MAX_VERIFICATION_ATTEMPTS && row.code_hash !== codeHash) {
      return { valid: false, error: "max_attempts" };
    }

    // Verify code hash
    if (row.code_hash !== codeHash) {
      return { valid: false, error: "invalid" };
    }

    // Delete the used verification code
    await db
      .delete(emailVerificationCodesTable)
      .where(eq(emailVerificationCodesTable.id, row.id));

    return { valid: true, userId };
  } catch (error) {
    console.error("[Verify Code] Database error:", error instanceof Error ? error.message : "unknown");
    return { valid: false, error: "db" };
  }
}
