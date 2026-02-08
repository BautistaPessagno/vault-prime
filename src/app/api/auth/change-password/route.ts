import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  hash,
  verify,
  deriveKey,
  masterPasswordHash,
} from "@/src/lib/auth/encryption";
import {
  getSessionData,
  encryptValue,
} from "@/src/lib/entries/crypto";
import { verifySessionToken } from "@/src/lib/auth/jwt";
import { getKeyCache } from "@/src/lib/cache";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";

type ChangePasswordBody = {
  currentPassword: string;
  newPassword: string;
};

async function readBody(request: Request): Promise<ChangePasswordBody | null> {
  try {
    const body = await request.json();
    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");
    if (!currentPassword || !newPassword) {
      return null;
    }
    return { currentPassword, newPassword };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // 1. Leer credenciales
  const body = await readBody(req);
  if (!body) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const { currentPassword, newPassword } = body;

  // 2. Obtener sesión actual
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 3. Obtener usuario de BD
  let user: { email: string; master_password_hash: string } | undefined;
  try {
    const rows = await db
      .select({
        email: usersTable.email,
        master_password_hash: usersTable.master_password_hash,
      })
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);
    user = rows[0];
  } catch (error) {
    console.error("[Auth ChangePassword] Database error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 4. Verificar password actual
  const salt = Buffer.from(user.email);
  const currentMasterKey = await hash(currentPassword, salt);
  const valid = await verify(currentMasterKey, user.master_password_hash);
  if (!valid) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  // 5. Generar nuevas credenciales
  const newMasterKey = await hash(newPassword, salt);
  const newMasterPasswordHash = await masterPasswordHash(newMasterKey);
  const newStrechedKey = await deriveKey(newMasterKey, newPassword);

  // 6. Re-encriptar encryption_key con nueva strechedKey
  // (la encryptionKey no cambia, solo se re-encripta con la nueva key derivada)
  const newEncryptedKey = await encryptValue(
    session.encryptionKey,
    newStrechedKey,
  );

  // 7. Actualizar BD
  try {
    await db
      .update(usersTable)
      .set({
        master_password_hash: newMasterPasswordHash,
        encryption_key: newEncryptedKey,
      })
      .where(eq(usersTable.id, session.userId));
  } catch (error) {
    console.error("[Auth ChangePassword] Update error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  // 8. Invalidar sesión actual
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (token) {
      const payload = await verifySessionToken(token);
      if (typeof payload.sid === "string") {
        const keyCache = getKeyCache();
        await keyCache.delete(payload.sid);
      }
    }
  } catch (error) {
    console.error("[Auth ChangePassword] Cache cleanup error:", error instanceof Error ? error.message : "unknown");
    // No fallar si no podemos limpiar el cache
  }

  // 9. Borrar cookie y retornar éxito
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("session");
  return response;
}
