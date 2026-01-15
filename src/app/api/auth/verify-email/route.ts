import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { usersTable, emailVerificationTokensTable } from "@/src/db/schema";
import { eq, sql } from "drizzle-orm";

type VerifyEmailTokenRow = {
  id: string;
  user_id: string;
  expires_at: Date | null;
  attempts: number;
};

export async function POST(req: Request) {
  let token: unknown;
  try {
    const body = await req.json();
    token = body?.token;
  } catch {
    token = undefined;
  }

  if (typeof token !== "string" || token.trim() === "") {
    return NextResponse.json({ error: "missing token" }, { status: 400 });
  }

  let verificationTokenRow: VerifyEmailTokenRow | undefined;
  try {
    const tokenRow = await db
      .select({
        id: emailVerificationTokensTable.id,
        user_id: emailVerificationTokensTable.user_id,
        expires_at: emailVerificationTokensTable.expires_at,
        attempts: emailVerificationTokensTable.attempts,
      })
      .from(emailVerificationTokensTable)
      .where(eq(emailVerificationTokensTable.token, token))
      .limit(1);
    verificationTokenRow = tokenRow[0];
  } catch (error) {
    console.error("[Auth Verify Email] Database error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  if (!verificationTokenRow) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  if (verificationTokenRow.expires_at) {
    if (verificationTokenRow.expires_at.getTime() < Date.now()) {
      return NextResponse.json({ error: "expired" }, { status: 400 });
    }
  }

  try {
    await db
      .update(emailVerificationTokensTable)
      .set({ attempts: sql`${emailVerificationTokensTable.attempts} + 1` })
      .where(eq(emailVerificationTokensTable.id, verificationTokenRow.id));
  } catch (error) {
    console.error("[Auth Verify Email] Attempts update error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  // Update user record with verified_at timestamp.
  try {
    await db
      .update(usersTable)
      .set({ verified_at: new Date() })
      .where(eq(usersTable.id, verificationTokenRow.user_id));
  } catch (error) {
    console.error("[Auth Verify Email] Update error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
