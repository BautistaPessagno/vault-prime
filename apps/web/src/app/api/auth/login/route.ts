import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { hash, verify, deriveKey } from "@/src/lib/auth/encryption";
import { decryptValue } from "@/src/lib/entries/crypto";
import { signSessionToken } from "@/src/lib/auth/jwt";
import { generateSessionId } from "@/src/lib/auth/session";
import { getKeyCache, CACHE_CONFIG } from "@/src/lib/cache";
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 10,
  keyPrefix: "ratelimit:login:ip:",
};

const EMAIL_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
  keyPrefix: "ratelimit:login:email:",
};

function wantsJson(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("json");
}

async function readBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return await request.json();
  }

  const formData = await request.formData();
  return {
    email: formData.get("email"),
    password: formData.get("password"),
  };
}

function withError(
  request: Request,
  code: string,
  status: number,
  headers?: Record<string, string>,
) {
  if (wantsJson(request)) {
    return NextResponse.json({ error: code }, { status, headers });
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

function withSuccess(request: Request, token: string) {
  const response = wantsJson(request)
    ? NextResponse.json({ ok: true, token })
    : NextResponse.redirect(new URL("/", request.url));

  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 15, // 15 minutes (in seconds)
  });

  return response;
}

export async function POST(req: Request) {
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);

  // Check IP rate limit first
  if (ipAddress) {
    const ipRateLimit = await checkRateLimit(ipAddress, IP_RATE_LIMIT);
    if (!ipRateLimit.allowed) {
      await logAuditEvent({
        eventType: "login_failed",
        ipAddress,
        userAgent,
        metadata: { reason: "ip_rate_limited" },
      });
      const retryAfter = Math.ceil((ipRateLimit.resetAt - Date.now()) / 1000);
      return withError(req, "rate_limited", 429, {
        "Retry-After": String(retryAfter),
      });
    }
  }

  // Parse and validate input
  const body = await readBody(req);
  const parseResult = loginSchema.safeParse(body);

  if (!parseResult.success) {
    return withError(req, "missing", 400);
  }

  const { email, password } = parseResult.data;

  // Check email rate limit
  const emailRateLimit = await checkRateLimit(email, EMAIL_RATE_LIMIT);
  if (!emailRateLimit.allowed) {
    await logAuditEvent({
      eventType: "login_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "email_rate_limited", email },
    });
    const retryAfter = Math.ceil((emailRateLimit.resetAt - Date.now()) / 1000);
    return withError(req, "rate_limited", 429, {
      "Retry-After": String(retryAfter),
    });
  }

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
      "[Auth Login] Database error:",
      error instanceof Error ? error.message : "unknown",
    );
    return withError(req, "db", 500);
  }

  if (!user?.master_password_hash) {
    // Perform dummy hash to normalize timing and prevent user enumeration
    const dummySalt = Buffer.from(email);
    await hash("dummy-password-for-timing", dummySalt);

    await logAuditEvent({
      eventType: "login_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "user_not_found", email },
    });
    return withError(req, "invalid", 401);
  }

  // Check account lockout
  const lockoutStatus = await checkLockout(user.id);
  if (lockoutStatus.locked) {
    await logAuditEvent({
      userId: user.id,
      eventType: "login_locked",
      ipAddress,
      userAgent,
      metadata: {
        email,
        lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
      },
    });
    return withError(req, "locked", 423);
  }

  const salt = Buffer.from(email);
  const masterKey = await hash(password, salt);
  const ok = await verify(masterKey, user.master_password_hash);

  if (!ok) {
    // Record failed login attempt
    const newLockoutStatus = await recordFailedLogin(user.id);

    await logAuditEvent({
      userId: user.id,
      eventType: newLockoutStatus.locked ? "login_locked" : "login_failed",
      ipAddress,
      userAgent,
      metadata: {
        email,
        failedAttempts: newLockoutStatus.failedAttempts,
        locked: newLockoutStatus.locked,
      },
    });

    if (newLockoutStatus.locked) {
      return withError(req, "locked", 423);
    }

    return withError(req, "invalid", 401);
  }

  if (!user.verified_at) {
    await logAuditEvent({
      userId: user.id,
      eventType: "login_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "unverified", email },
    });
    return withError(req, "unverified", 403);
  }

  // Clear failed login attempts on successful login
  await clearFailedLogins(user.id);

  // Reset per-email rate limit on success; keep per-IP counter intact so
  // shared-IP tenants (office NAT / CGNAT) can't get their window cleared by
  // a co-tenant's successful login.
  await resetRateLimit(email, EMAIL_RATE_LIMIT.keyPrefix);

  // Check for missing encryption key (data integrity issue)
  if (!user.encryption_key) {
    await logAuditEvent({
      userId: user.id,
      eventType: "login_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "missing_encryption_key", email },
    });
    return withError(req, "invalid", 500);
  }

  // Derive stretched master key and decrypt encryption key
  const stretchedMasterKey = await deriveKey(masterKey, password);
  const encryptionKey = await decryptValue(
    user.encryption_key,
    stretchedMasterKey,
  );

  // Store encryption key in cache
  const sessionId = generateSessionId(String(user.id));
  const keyCache = getKeyCache();
  await keyCache.set(sessionId, encryptionKey, CACHE_CONFIG.ttlSeconds);

  const token = await signSessionToken({
    sub: String(user.id),
    email,
    sid: sessionId,
  });

  await logAuditEvent({
    userId: user.id,
    eventType: "login_success",
    ipAddress,
    userAgent,
    metadata: { email },
  });

  return withSuccess(req, token);
}
