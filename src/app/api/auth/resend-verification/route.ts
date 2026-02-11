import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";
import { generateAuthCode } from "@/src/lib/auth/verification";
import { sendVerificationEmail } from "@/src/lib/email/send-verification-email";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import { getClientIp } from "@/src/lib/security/audit-log";

const RESEND_IP_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 3,
  keyPrefix: "ratelimit:resend:ip:",
};

const RESEND_EMAIL_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
  keyPrefix: "ratelimit:resend:email:",
};

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export async function POST(req: Request) {
  // Rate limit by IP
  const ipAddress = getClientIp(req);
  if (ipAddress) {
    const ipRateLimit = await checkRateLimit(ipAddress, RESEND_IP_RATE_LIMIT);
    if (!ipRateLimit.allowed) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }

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

  // Rate limit by email
  const emailRateLimit = await checkRateLimit(email, RESEND_EMAIL_RATE_LIMIT);
  if (!emailRateLimit.allowed) {
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

    const code = await generateAuthCode(user.id);
    if (!code) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const verifyUrl = new URL("/verify-email", req.url);
    verifyUrl.searchParams.set("email", email);
    const sent = await sendVerificationEmail({
      to: email,
      verifyUrl: verifyUrl.toString(),
      code,
    });
    if (!sent.ok) {
      console.error("[Auth Resend Verification] Email error:", sent.error);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[Auth Resend Verification] Database error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

