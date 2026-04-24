import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { hash, verify } from "@/src/lib/auth/encryption";
import { signSessionToken } from "@/src/lib/auth/jwt";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";
import { loginSchema } from "@/src/lib/validation/schemas";
import { checkRateLimit, resetRateLimit } from "@/src/lib/security/rate-limit";
import {
  checkLockout,
  recordFailedLogin,
  clearFailedLogins,
} from "@/src/lib/security/lockout";
import {
  logAuditEvent,
  getClientIp,
  getUserAgent,
} from "@/src/lib/security/audit-log";

type LoginUserRow = {
  id: string;
  master_password_hash: string;
  verified_at: Date | null;
  encryption_key: string | null;
};

const IP_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
  keyPrefix: "ratelimit:ext-login:ip:",
};

const EMAIL_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
  keyPrefix: "ratelimit:ext-login:email:",
};

export async function POST(req: Request) {
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);

  // IP rate limit
  if (ipAddress) {
    const ipRateLimit = await checkRateLimit(ipAddress, IP_RATE_LIMIT);
    if (!ipRateLimit.allowed) {
      await logAuditEvent({
        eventType: "extension_login_failed",
        ipAddress,
        userAgent,
        metadata: { reason: "ip_rate_limited" },
      });
      const retryAfter = Math.ceil((ipRateLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  // Parse and validate
  const body = await req.json().catch(() => null);
  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }

  const { email, password } = parseResult.data;

  // Email rate limit
  const emailRateLimit = await checkRateLimit(email, EMAIL_RATE_LIMIT);
  if (!emailRateLimit.allowed) {
    await logAuditEvent({
      eventType: "extension_login_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "email_rate_limited", email },
    });
    const retryAfter = Math.ceil((emailRateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // Fetch user
  let user: LoginUserRow | undefined;
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        master_password_hash: usersTable.master_password_hash,
        verified_at: usersTable.verified_at,
        encryption_key: usersTable.encryption_key,
      })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    user = rows[0];
  } catch (error) {
    console.error(
      "[Extension Login] Database error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  if (!user?.master_password_hash) {
    const dummySalt = Buffer.from(email);
    await hash("dummy-password-for-timing", dummySalt);
    await logAuditEvent({
      eventType: "extension_login_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "user_not_found", email },
    });
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  // Check lockout
  const lockoutStatus = await checkLockout(user.id);
  if (lockoutStatus.locked) {
    await logAuditEvent({
      userId: user.id,
      eventType: "extension_login_failed",
      ipAddress,
      userAgent,
      metadata: {
        email,
        reason: "locked",
        lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
      },
    });
    return NextResponse.json({ error: "locked" }, { status: 423 });
  }

  // Hash and verify
  const salt = Buffer.from(email);
  const masterKey = await hash(password, salt);
  const ok = await verify(masterKey, user.master_password_hash);

  if (!ok) {
    const newLockoutStatus = await recordFailedLogin(user.id);
    await logAuditEvent({
      userId: user.id,
      eventType: "extension_login_failed",
      ipAddress,
      userAgent,
      metadata: {
        email,
        failedAttempts: newLockoutStatus.failedAttempts,
        locked: newLockoutStatus.locked,
      },
    });
    if (newLockoutStatus.locked) {
      return NextResponse.json({ error: "locked" }, { status: 423 });
    }
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  // Must be verified
  if (!user.verified_at) {
    await logAuditEvent({
      userId: user.id,
      eventType: "extension_login_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "unverified", email },
    });
    return NextResponse.json({ error: "unverified" }, { status: 403 });
  }

  // Clear failed logins + per-email rate limit (keep per-IP counter).
  await clearFailedLogins(user.id);
  await resetRateLimit(email, EMAIL_RATE_LIMIT.keyPrefix);

  // Check encryption key exists
  if (!user.encryption_key) {
    await logAuditEvent({
      userId: user.id,
      eventType: "extension_login_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "missing_encryption_key", email },
    });
    return NextResponse.json({ error: "invalid" }, { status: 500 });
  }

  // Sign JWT (no session ID needed -- extension decrypts locally)
  const token = await signSessionToken({
    sub: String(user.id),
    email,
  });

  await logAuditEvent({
    userId: user.id,
    eventType: "extension_login_success",
    ipAddress,
    userAgent,
    metadata: { email },
  });

  // Return token + encrypted encryption key + master key hash
  return NextResponse.json({
    token,
    encryptedEncryptionKey: user.encryption_key,
    masterKeyHash: masterKey,
    email,
  });
}
