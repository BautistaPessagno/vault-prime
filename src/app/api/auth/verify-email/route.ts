import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/src/db";
import { usersTable, emailVerificationCodesTable } from "@/src/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifySessionToken } from "@/src/lib/auth/jwt";

type VerifyEmailCodeRow = {
  id: string;
  user_id: string;
  expires_at: Date | null;
  attempts: number;
};

async function getSuccessRedirect(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return new URL("/login", request.url);
  }

  try {
    await verifySessionToken(token);
    return new URL("/", request.url);
  } catch {
    return new URL("/login", request.url);
  }
}

export async function POST(req: Request) {
  let code: unknown;
  try {
    const body = await req.json();
    code = body?.code;
  } catch {
    code = undefined;
  }

  if (typeof code !== "string" || code.trim() === "") {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  let verificationCodeRow: VerifyEmailCodeRow | undefined;
  try {
    const codeRow = await db
      .select({
        id: emailVerificationCodesTable.id,
        user_id: emailVerificationCodesTable.user_id,
        expires_at: emailVerificationCodesTable.expires_at,
        attempts: emailVerificationCodesTable.attempts,
      })
      .from(emailVerificationCodesTable)
      .where(eq(emailVerificationCodesTable.code, code))
      .limit(1);
    verificationCodeRow = codeRow[0];
  } catch (error) {
    console.error("[Auth Verify Email] Database error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  if (!verificationCodeRow) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }

  if (verificationCodeRow.expires_at) {
    if (verificationCodeRow.expires_at.getTime() < Date.now()) {
      return NextResponse.json({ error: "expired" }, { status: 400 });
    }
  }

  try {
    await db
      .update(emailVerificationCodesTable)
      .set({ attempts: sql`${emailVerificationCodesTable.attempts} + 1` })
      .where(eq(emailVerificationCodesTable.id, verificationCodeRow.id));
  } catch (error) {
    console.error("[Auth Verify Email] Attempts update error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  // Update user record with verified_at timestamp.
  try {
    await db
      .update(usersTable)
      .set({ verified_at: new Date() })
      .where(eq(usersTable.id, verificationCodeRow.user_id));
  } catch (error) {
    console.error("[Auth Verify Email] Update error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  const redirectUrl = await getSuccessRedirect(req);
  return NextResponse.redirect(redirectUrl);
}
