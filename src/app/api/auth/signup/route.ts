import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { hash, masterPasswordHash } from "@/src/lib/auth/encryption";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";
import { generateAuthToken } from "@/src/lib/auth/verification";
import { sendVerificationEmail } from "@/src/lib/email/send-verification-email";

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

function withSuccess(request: Request, email: string, emailSent: boolean) {
  if (wantsJson(request)) {
    return NextResponse.json({ ok: true, emailSent });
  }

  const url = new URL("/verify-email/pending", request.url);
  url.searchParams.set("email", email);
  return NextResponse.redirect(url);
}

export async function POST(req: Request) {
  const { email, password } = await readCredentials(req);
  if (!email || !password) {
    return withError(req, "missing", 400);
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

  let createdUserId: string | undefined;
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

  const verificationToken = await generateAuthToken(createdUserId);

  let emailSent = false;
  if (verificationToken) {
    const origin = new URL(req.url).origin;
    const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(
      verificationToken,
    )}`;
    const sent = await sendVerificationEmail({ to: email, verifyUrl });
    emailSent = sent.ok;
    if (!sent.ok) {
      console.error("[Auth Signup] Verification email error:", sent.error);
    }
  }

  return withSuccess(req, email, emailSent);
}
