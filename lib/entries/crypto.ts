import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/jwt";
import { generateNonce, encrypt, decrypt } from "@/lib/auth/encryption";

export type EntryRow = {
  id: string;
  user_id: string;
  created_at: string;
  nombre: string;
  usuario: string;
  password: string;
  last_edited: string | null;
  last_copied: string | null;
};

// API input/output type
export type EntryInput = {
  nombre: string;
  usuario: string;
  password: string;
};

type DbEntryFields = Pick<EntryRow, "nombre" | "usuario" | "password">;

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
