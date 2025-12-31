import { cookies } from "next/headers";
import { verifySessionToken } from "@/src/lib/auth/jwt";
import { generateNonce, encrypt, decrypt } from "@/src/lib/auth/encryption";

export type EntryRow = {
  id: string | number;
  user_id: string | number;
  nombre: string;
  usuario: string;
  password: string;
  url: string;
  last_edited: string | null;
  last_copied: string | null;
};

// API input/output type
export type EntryInput = {
  nombre: string;
  usuario: string;
  password: string;
  url: string;
};

type DbEntryFields = Pick<EntryRow, "nombre" | "usuario" | "password" | "url">;

type SessionData = {
  userId: string;
  encryptionKey: string;
} | null;

export async function getSessionData(): Promise<SessionData> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) {
    console.log("[Auth] No session cookie found");
    return null;
  }
  try {
    const payload = await verifySessionToken(token);

    // Handle both string and number user IDs
    const userId = payload.sub != null ? String(payload.sub) : null;
    const encryptionKey = typeof payload.ek === "string" ? payload.ek : null;

    if (!userId) {
      console.log("[Auth] Missing userId in session");
      return null;
    }

    if (!encryptionKey) {
      // Old token format without encryption key - user needs to re-login
      console.log("[Auth] Session missing encryption key - requires re-login");
      return null;
    }

    return { userId, encryptionKey };
  } catch (error) {
    console.error("[Auth] Token verification failed:", error);
    return null;
  }
}

export async function requireSessionUserId() {
  const session = await getSessionData();
  return session?.userId ?? null;
}

export async function getSessionEncryptionKey() {
  const session = await getSessionData();
  return session?.encryptionKey ?? null;
}

// Encrypt fields for database storage
export async function encryptEntryFields(
  fields: EntryInput,
  key: string,
): Promise<DbEntryFields> {
  return {
    nombre: await encryptValue(fields.nombre, key),
    usuario: await encryptValue(fields.usuario, key),
    password: await encryptValue(fields.password, key),
    url: await encryptValue(fields.url, key),
  };
}

// Decrypt fields from database
export async function decryptEntryFields(
  fields: DbEntryFields,
  key: string,
): Promise<EntryInput> {
  return {
    nombre: await decryptValue(fields.nombre, key),
    usuario: await decryptValue(fields.usuario, key),
    password: await decryptValue(fields.password, key),
    url: await decryptValue(fields.url, key),
  };
}

async function encryptValue(value: string, key: string) {
  const nonce = await generateNonce();
  const ciphertext = await encrypt(key, nonce, value);
  return `${nonce}:${ciphertext}`;
}

async function decryptValue(value: string, key: string) {
  if (!value) {
    return "";
  }
  const [nonce, ciphertext] = value.split(":");
  if (!nonce || !ciphertext) {
    return value;
  }
  return decrypt(key, nonce, ciphertext);
}
