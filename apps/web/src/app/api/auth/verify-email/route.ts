import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { verifySessionToken } from "@/src/lib/auth/jwt";
import { verifyCode } from "@/src/lib/auth/verification";
import { verifyEmailSchema } from "@/src/lib/validation/schemas";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import {
  logAuditEvent,
  getClientIp,
  getUserAgent,
} from "@/src/lib/security/audit-log";

const VERIFY_IP_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 10,
  keyPrefix: "ratelimit:verify:ip:",
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

async function getUserIdFromSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifySessionToken(token);
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);

  // Rate limit by IP
  if (ipAddress) {
    const ipRateLimit = await checkRateLimit(ipAddress, VERIFY_IP_RATE_LIMIT);
    if (!ipRateLimit.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  }

  // Parse and validate input
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parseResult = verifyEmailSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  const { code } = parseResult.data;

  // Get user ID from session
  const userId = await getUserIdFromSession();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Verify the code using the secure verification function
  const result = await verifyCode(userId, code);

  if (!result.valid) {
    if (result.error === "max_attempts") {
      await logAuditEvent({
        userId,
        eventType: "email_verification_max_attempts",
        ipAddress,
        userAgent,
      });
      return NextResponse.json(
        { error: "max_attempts" },
        { status: 429 }
      );
    }

    await logAuditEvent({
      userId,
      eventType: "email_verification_failed",
      ipAddress,
      userAgent,
      metadata: { reason: result.error },
    });

    if (result.error === "expired") {
      return NextResponse.json({ error: "expired" }, { status: 400 });
    }

    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }

  // Update user record with verified_at timestamp
  try {
    await db
      .update(usersTable)
      .set({ verified_at: new Date() })
      .where(eq(usersTable.id, userId));
  } catch (error) {
    console.error("[Auth Verify Email] Update error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  await logAuditEvent({
    userId,
    eventType: "email_verified",
    ipAddress,
    userAgent,
  });

  const redirectUrl = await getSuccessRedirect(req);
  return NextResponse.redirect(redirectUrl);
}
