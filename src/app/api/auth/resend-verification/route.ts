import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";
import { generateAuthToken } from "@/src/lib/auth/verification";
import { sendVerificationEmail } from "@/src/lib/email/send-verification-email";

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export async function POST(req: Request) {
  let email: string;
  try {
    const body = await req.json();
    email = normalizeEmail(body?.email);
  } catch {
    email = "";
  }

  // Always respond with ok to avoid email enumeration.
  if (!email) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    const rows = await db
      .select({
        id: usersTable.id,
        verified_at: usersTable.verified_at,
      })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (user.verified_at) {
      return NextResponse.json({ ok: true, alreadyVerified: true }, { status: 200 });
    }

    const token = await generateAuthToken(user.id);
    if (!token) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const origin = new URL(req.url).origin;
    const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;
    const sent = await sendVerificationEmail({ to: email, verifyUrl });
    if (!sent.ok) {
      console.error("[Auth Resend Verification] Email error:", sent.error);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[Auth Resend Verification] Database error:", error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

