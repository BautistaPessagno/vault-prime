import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { hash, verify, deriveKey } from "@/src/lib/auth/encryption";
import { signSessionToken } from "@/src/lib/auth/jwt";
import { generateSessionId } from "@/src/lib/auth/session";
import { getKeyCache, CACHE_CONFIG } from "@/src/lib/cache";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";

type Credentials = {
  email: string;
  password: string;
};

type LoginUserRow = {
  id: string;
  master_password_hash: string;
  verified_at: string | null;
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
    };
  }

  const formData = await request.formData();
  return {
    email: normalizeEmail(formData.get("email")),
    password: normalizePassword(formData.get("password")),
  };
}

function withError(request: Request, code: string, status: number) {
  if (wantsJson(request)) {
    return NextResponse.json({ error: code }, { status });
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
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 15, // 15 minutes
  });

  return response;
}

export async function POST(req: Request) {
  const { email, password } = await readCredentials(req);
  if (!email || !password) {
    return withError(req, "missing", 400);
  }
  let user: LoginUserRow | undefined;
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        master_password_hash: usersTable.master_password_hash,
        verified_at: usersTable.verified_at,
      })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    user = rows[0];
  } catch (error) {
    console.error("[Auth Login] Database error:", error);
    return withError(req, "db", 500);
  }

  if (!user?.master_password_hash) {
    return withError(req, "invalid", 401);
  }

  const salt = Buffer.from(email);
  const masterKey = await hash(password, salt);
  const ok = await verify(masterKey, user.master_password_hash);
  if (!ok) {
    return withError(req, "invalid", 401);
  }

  if (!user.verified_at) {
    return withError(req, "unverified", 403);
  }

  // Derive encryption key and store in cache
  const encryptionKey = await deriveKey(masterKey, password);
  const sessionId = generateSessionId();
  const keyCache = getKeyCache();
  await keyCache.set(sessionId, encryptionKey, CACHE_CONFIG.ttlSeconds);

  const token = await signSessionToken({
    sub: String(user.id),
    email,
    sid: sessionId,
  });
  return withSuccess(req, token);
}
