import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  hash,
  verify,
  deriveKey,
  generateEncryptionKey,
} from "@/src/lib/auth/encryption";
import {
  decryptValue,
  encryptValue,
  encryptEntryFields,
  decryptEntryFields,
} from "@/src/lib/entries/crypto";
import { signSessionToken } from "@/src/lib/auth/jwt";
import { generateSessionId } from "@/src/lib/auth/session";
import { getKeyCache, CACHE_CONFIG } from "@/src/lib/cache";
import { db } from "@/src/db";
import { usersTable, entriesTable } from "@/src/db/schema";

type Credentials = {
  email: string;
  password: string;
};

type LoginUserRow = {
  id: string;
  master_password_hash: string;
  verified_at: Date | null;
  encryption_key: string | null;
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
        encryption_key: usersTable.encryption_key,
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

  // Derive streched master key
  const strechedMasterKey = await deriveKey(masterKey, password);
  let encryptionKey: string;

  if (!user.encryption_key) {
    // === MIGRACIÓN DE USUARIO VIEJO ===
    // Usuario sin encryption_key: generar nueva y re-encriptar entries

    // 1. Generar nueva encryptionKey
    encryptionKey = await generateEncryptionKey();

    // 2. Obtener entries del usuario
    const entries = await db
      .select()
      .from(entriesTable)
      .where(eq(entriesTable.user_id, user.id));

    // 3. Re-encriptar cada entry
    for (const entry of entries) {
      // Desencriptar con strechedMasterKey (modelo viejo)
      const decrypted = await decryptEntryFields(
        {
          name: entry.name,
          username: entry.username,
          password: entry.password,
          url: entry.url,
        },
        strechedMasterKey,
      );

      // Re-encriptar con nueva encryptionKey (modelo nuevo)
      const encrypted = await encryptEntryFields(decrypted, encryptionKey);

      // Actualizar en BD
      await db
        .update(entriesTable)
        .set(encrypted)
        .where(eq(entriesTable.id, entry.id));
    }

    // 4. Guardar encryption_key encriptada en BD
    const encryptedKey = await encryptValue(encryptionKey, strechedMasterKey);
    await db
      .update(usersTable)
      .set({ encryption_key: encryptedKey })
      .where(eq(usersTable.id, user.id));
  } else {
    // Usuario con encryption_key existente - desencriptar
    encryptionKey = await decryptValue(user.encryption_key, strechedMasterKey);
  }

  // Store encryption key in cache
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
