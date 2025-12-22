import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hash, verify } from "@/lib/auth/encryption";
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
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function POST(req: Request) {
  const { email, password } = await readCredentials(req);
  if (!email || !password) {
    return withError(req, "missing", 400);
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, master_password_hash")
    .eq("email", email)
    .maybeSingle();

  if (error || !user || !user.master_password_hash) {
    return withError(req, "invalid", 401);
  }

  const masterKey = await hash(password);
  const ok = await verify(masterKey, user.master_password_hash);
  if (!ok) {
    return withError(req, "invalid", 401);
  }

  const token = await signSessionToken({ sub: user.id, email });
  return withSuccess(req, token);
}
