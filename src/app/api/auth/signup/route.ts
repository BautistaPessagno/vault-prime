import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  hash,
  masterPasswordHash,
  generateEncryptionKey,
  deriveKey,
} from "@/src/lib/auth/encryption";
import { encryptValue } from "@/src/lib/entries/crypto";
import { signSessionToken } from "@/src/lib/auth/jwt";
import { generateSessionId } from "@/src/lib/auth/session";
import { getKeyCache, CACHE_CONFIG } from "@/src/lib/cache";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";
import { generateAuthCode } from "@/src/lib/auth/verification";
import { sendVerificationEmail } from "@/src/lib/email/send-verification-email";
import { z } from "zod";
import { signupSchema } from "@/src/lib/validation/schemas";
import { validatePassword } from "@/src/lib/security/password-validation";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import {
  logAuditEvent,
  getClientIp,
  getUserAgent,
} from "@/src/lib/security/audit-log";

const SIGNUP_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
  keyPrefix: "ratelimit:signup:ip:",
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
    passwordConfirmation: formData.get("passwordConfirmation"),
  };
}

function withError(
  request: Request,
  code: string,
  status: number,
  details?: { errors?: string[]; feedback?: { warning: string; suggestions: string[] } }
) {
  if (wantsJson(request)) {
    return NextResponse.json({ error: code, ...details }, { status });
  }

  const url = new URL("/signup", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

function withSuccess(
  request: Request,
  email: string,
  emailSent: boolean,
  token: string
) {
  if (wantsJson(request)) {
    const response = NextResponse.json({ ok: true, emailSent, token });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 15, // 15 minutes (in seconds)
    });
    return response;
  }

  const url = new URL("/verify-email", request.url);
  url.searchParams.set("email", email);
  const response = NextResponse.redirect(url);
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

  // Check IP rate limit
  if (ipAddress) {
    const ipRateLimit = await checkRateLimit(ipAddress, SIGNUP_RATE_LIMIT);
    if (!ipRateLimit.allowed) {
      await logAuditEvent({
        eventType: "signup_failed",
        ipAddress,
        userAgent,
        metadata: { reason: "ip_rate_limited" },
      });
      return withError(req, "rate_limited", 429);
    }
  }

  // Parse and validate input with Zod
  const body = await readBody(req);
  const parseResult = signupSchema.safeParse(body);

  if (!parseResult.success) {
    const flat = z.flattenError(parseResult.error);
    const errors = [
      ...flat.formErrors,
      ...Object.values(flat.fieldErrors).flat(),
    ];
    await logAuditEvent({
      eventType: "signup_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "validation_failed", errors },
    });
    return withError(req, "validation", 400, { errors });
  }

  const { email, password } = parseResult.data;

  // Validate password strength
  const passwordValidation = validatePassword(password, [email]);
  if (!passwordValidation.valid) {
    await logAuditEvent({
      eventType: "signup_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "weak_password", email },
    });
    return withError(req, "weak_password", 400, {
      errors: passwordValidation.errors,
      feedback: passwordValidation.feedback,
    });
  }

  let existingId: string | undefined;
  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    existingId = existing[0]?.id;
  } catch (error) {
    console.error("[Auth Signup] Database error:", error instanceof Error ? error.message : "unknown");
    return withError(req, "db", 500);
  }

  if (existingId) {
    await logAuditEvent({
      eventType: "signup_failed",
      ipAddress,
      userAgent,
      metadata: { reason: "email_exists", email },
    });
    return withError(req, "exists", 409);
  }

  const salt = Buffer.from(email);
  const masterKey = await hash(password, salt);
  const masterPasswordHashValue = await masterPasswordHash(masterKey);
  const strechedMasterKey = await deriveKey(masterKey, password);
  const encryptionKey = await generateEncryptionKey();

  const encryptedKey = await encryptValue(encryptionKey, strechedMasterKey);

  let createdUserId: string | undefined;
  try {
    const created = await db
      .insert(usersTable)
      .values({
        email,
        master_password_hash: masterPasswordHashValue,
        encryption_key: encryptedKey,
      })
      .returning({ id: usersTable.id });
    createdUserId = created[0]?.id;
  } catch (error) {
    console.error("[Auth Signup] Insert error:", error instanceof Error ? error.message : "unknown");
    return withError(req, "insert", 500);
  }

  if (!createdUserId) {
    return withError(req, "insert", 500);
  }

  const sessionId = generateSessionId();
  const keyCache = getKeyCache();
  await keyCache.set(sessionId, encryptionKey, CACHE_CONFIG.ttlSeconds);

  const token = await signSessionToken({
    sub: String(createdUserId),
    email,
    sid: sessionId,
  });

  const verificationCode = await generateAuthCode(createdUserId);

  let emailSent = false;
  if (verificationCode) {
    const verifyUrl = new URL("/verify-email", req.url);
    verifyUrl.searchParams.set("email", email);
    const sent = await sendVerificationEmail({
      to: email,
      verifyUrl: verifyUrl.toString(),
      code: verificationCode,
    });
    emailSent = sent.ok;
    if (!sent.ok) {
      console.error("[Auth Signup] Verification email error:", sent.error);
    }
  }

  await logAuditEvent({
    userId: createdUserId,
    eventType: "signup",
    ipAddress,
    userAgent,
    metadata: { email, emailSent },
  });

  return withSuccess(req, email, emailSent, token);
}
