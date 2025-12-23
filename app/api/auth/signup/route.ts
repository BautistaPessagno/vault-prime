import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hash, masterPasswordHash, deriveKey } from "@/lib/auth/encryption";
import { signSessionToken } from "@/lib/auth/jwt";

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

  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    return withError(req, "db", 500);
  }

  if (existing) {
    return withError(req, "exists", 409);
  }

  const salt = Buffer.from(email);
  const masterKey = await hash(password, salt);
  const masterPasswordHashValue = await masterPasswordHash(masterKey);

  const { data: createdUser, error: insertError } = await supabase
    .from("users")
    .insert({
      email,
      master_password_hash: masterPasswordHashValue,
    })
    .select("id")
    .single();

  if (insertError || !createdUser) {
    return withError(req, "insert", 500);
  }

  // Derive encryption key for entries and include it in the session
  const encryptionKey = await deriveKey(masterKey, password);
  const token = await signSessionToken({
    sub: createdUser.id,
    email,
    ek: encryptionKey,
  });
  return withSuccess(req, token);
}
