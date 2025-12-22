import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth/jwt";
import {
  hash,
  deriveKey,
  generateNonce,
  encrypt,
  decrypt,
} from "@/lib/auth/encryption";

export type EntryRow = {
  id: string;
  user_id: string;
  created_at: string;
  nombre: string;
  usuario: string;
  contrasena: string;
  last_edited: string | null;
  last_copied: string | null;
};

type EntryFields = Pick<EntryRow, "nombre" | "usuario" | "contrasena">;

export async function requireSessionUserId() {
  const token = (await cookies()).get("session")?.value;
  if (!token) {
    return null;
  }
  try {
    const payload = await verifySessionToken(token);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function deriveEntryKey(masterPassword: string) {
  const masterKey = await hash(masterPassword);
  return deriveKey(masterKey, masterPassword);
}

export async function encryptEntryFields(fields: EntryFields, key: string) {
  return {
    nombre: await encryptValue(fields.nombre, key),
    usuario: await encryptValue(fields.usuario, key),
    contrasena: await encryptValue(fields.contrasena, key),
  };
}

export async function decryptEntryFields(fields: EntryFields, key: string) {
  return {
    nombre: await decryptValue(fields.nombre, key),
    usuario: await decryptValue(fields.usuario, key),
    contrasena: await decryptValue(fields.contrasena, key),
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
