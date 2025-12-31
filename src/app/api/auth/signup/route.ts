import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { hash, masterPasswordHash, deriveKey } from "@/src/lib/auth/encryption";
import { signSessionToken } from "@/src/lib/auth/jwt";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";

type Credentials = {
  email: string;
  password: string;
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

  const url = new URL("/signup", request.url);
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
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}

export async function POST(req: Request) {
  const { email, password } = await readCredentials(req);
  if (!email || !password) {
    return withError(req, "missing", 400);
  }

  let existingId: number | undefined;
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

  let createdUserId: number | undefined;
  try {
    const created = await db
      .insert(usersTable)
      .values({
        email,
        master_password_hash: masterPasswordHashValue,
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

  // Derive encryption key for entries and include it in the session
  const encryptionKey = await deriveKey(masterKey, password);
  const token = await signSessionToken({
    sub: String(createdUserId),
    email,
    ek: encryptionKey,
  });
  return withSuccess(req, token);
}
