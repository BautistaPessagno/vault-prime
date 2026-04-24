import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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
import { getKeyCache } from "@/src/lib/cache";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import {
  logAuditEvent,
  getClientIp,
  getUserAgent,
} from "@/src/lib/security/audit-log";

const CHANGE_PASSWORD_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
  keyPrefix: "ratelimit:change-password:",
};

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
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);

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

  // Rate limit by userId
  const rateLimit = await checkRateLimit(session.userId, CHANGE_PASSWORD_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
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

  // 8. Invalidar todas las sesiones activas del usuario (este navegador,
  // extensión, otros dispositivos) borrando todas las entradas de caché
  // que comienzan con el prefijo `${userId}:`.
  try {
    const keyCache = getKeyCache();
    await keyCache.deleteByPrefix(`${session.userId}:`);
  } catch (error) {
    console.error("[Auth ChangePassword] Cache cleanup error:", error instanceof Error ? error.message : "unknown");
    // No fallar si no podemos limpiar el cache
  }

  await logAuditEvent({
    userId: session.userId,
    eventType: "password_changed",
    ipAddress,
    userAgent,
  });

  // 9. Borrar cookie y retornar éxito
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("session");
  return response;
}
