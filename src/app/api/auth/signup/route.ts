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

type Credentials = {
  email: string;
  password: string;
  passwordConfirmation: string;
};

function normalizeEmail(value: FormDataEntryValue | string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizePassword(value: FormDataEntryValue | string | null) {
  return String(value ?? "");
}

function wantsJson(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("json");
}

async function readCredentials(request: Request): Promise<Credentials> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      email: normalizeEmail(body?.email),
      password: normalizePassword(body?.password),
      passwordConfirmation: normalizePassword(body?.passwordConfirmation),
    };
  }

  const formData = await request.formData();
  return {
    email: normalizeEmail(formData.get("email")),
    password: normalizePassword(formData.get("password")),
    passwordConfirmation: normalizePassword(formData.get("passwordConfirmation")),
  };
}

function withError(request: Request, code: string, status: number) {
  if (wantsJson(request)) {
    return NextResponse.json({ error: code }, { status });
  }

  const url = new URL("/signup", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

function withSuccess(
  request: Request,
  email: string,
  emailSent: boolean,
  token: string,
) {
  if (wantsJson(request)) {
    const response = NextResponse.json({ ok: true, emailSent, token });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 1000 * 60 * 15, // 15 minutes
    });
    return response;
  }

  const url = new URL("/verify-email", request.url);
  url.searchParams.set("email", email);
  const response = NextResponse.redirect(url);
  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 15, // 15 minutes
  });
  return response;
}

export async function POST(req: Request) {
  const { email, password, passwordConfirmation } = await readCredentials(req);
  if (!email || !password || !passwordConfirmation) {
    return withError(req, "missing", 400);
  }

  if (password !== passwordConfirmation) {
    return withError(req, "password_mismatch", 400);
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
    console.error("[Auth Signup] Database error:", error);
    return withError(req, "db", 500);
  }

  if (existingId) {
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
    console.error("[Auth Signup] Insert error:", error);
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

  return withSuccess(req, email, emailSent, token);
}
