import { cookies } from "next/headers";
import { verifySessionToken } from "@/src/lib/auth/jwt";
import { generateNonce, encrypt, decrypt } from "@/src/lib/auth/encryption";
import { getKeyCache } from "@/src/lib/cache";

export type EntryRow = {
  id: string;
  user_id: string;
  name: string;
  username: string;
  password: string;
  url: string;
  created_at: string | null;
  last_edited: string | null;
  last_copied: string | null;
};

// API input/output type
export type EntryInput = {
  name: string;
  username: string;
  password: string;
  url: string;
};

type DbEntryFields = Pick<EntryRow, "name" | "username" | "password" | "url">;

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
    const sessionId = typeof payload.sid === "string" ? payload.sid : null;

    if (!userId) {
      console.log("[Auth] Missing userId in session");
      return null;
    }

    if (!sessionId) {
      console.log("[Auth] Session missing session ID - requires re-login");
      return null;
    }

    // Retrieve encryption key from cache
    const keyCache = getKeyCache();
    const encryptionKey = await keyCache.get(sessionId);

    if (!encryptionKey) {
      console.log("[Auth] Session key expired - requires re-login");
      return null;
    }

    return { userId, encryptionKey };
  } catch (error) {
    console.error("[Auth] Token verification failed:", error instanceof Error ? error.message : "unknown");
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
    name: await encryptValue(fields.name, key),
    username: await encryptValue(fields.username, key),
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
    name: await decryptValue(fields.name, key),
    username: await decryptValue(fields.username, key),
    password: await decryptValue(fields.password, key),
    url: await decryptValue(fields.url, key),
  };
}

export async function encryptValue(value: string, key: string) {
  const nonce = await generateNonce();
  const ciphertext = await encrypt(key, nonce, value);
  return `${nonce}:${ciphertext}`;
}

export async function decryptValue(value: string, key: string) {
  if (!value) {
    return "";
  }
  const [nonce, ciphertext] = value.split(":");
  if (!nonce || !ciphertext) {
    throw new Error("Malformed encrypted value: expected nonce:ciphertext format");
  }
  return decrypt(key, nonce, ciphertext);
}
