import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { entriesTable, type InsertEntry } from "@/src/db/schema";
import {
  getSessionData,
  encryptEntryFields,
  decryptEntryFields,
  type EntryRow,
} from "@/src/lib/entries/crypto";
import { getUserVerificationStatus } from "@/src/lib/auth/verify-user";
import { entrySchema } from "@/src/lib/validation/schemas";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import { logAuditEvent, getClientIp, getUserAgent } from "@/src/lib/security/audit-log";

const ENTRY_WRITE_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxAttempts: 30,
  keyPrefix: "ratelimit:entries:write:",
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId, encryptionKey } = session;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const verification = await getUserVerificationStatus(userId);
  if (verification.status === "error") {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  if (verification.status === "missing") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (verification.status === "unverified") {
    return NextResponse.json(
      { error: "unverified", email: verification.email },
      { status: 403 },
    );
  }
  const userIdForQuery = userId;
  const entryId = id;
  if (!entryId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Rate limit entry writes per user
  const rateLimit = await checkRateLimit(userId, ENTRY_WRITE_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);

  const parseResult = entrySchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: "validation", errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
  }
  const { name, username, password, url } = parseResult.data;

  const encryptedFields = await encryptEntryFields(
    { name, username, password, url },
    encryptionKey,
  );

  const updates: Partial<InsertEntry> = { ...encryptedFields };

  if (typeof body?.last_edited === "string") {
    updates.last_edited = body.last_edited;
  }

  if (typeof body?.last_copied === "string") {
    updates.last_copied = body.last_copied;
  }

  let entryRow: EntryRow | null = null;
  try {
    const updated = await db
      .update(entriesTable)
      .set(updates)
      .where(
        and(
          eq(entriesTable.id, entryId),
          eq(entriesTable.user_id, userIdForQuery),
        ),
      )
      .returning({
        id: entriesTable.id,
        user_id: entriesTable.user_id,
        name: entriesTable.name,
        username: entriesTable.username,
        password: entriesTable.password,
        url: entriesTable.url,
        created_at: entriesTable.created_at,
        last_edited: entriesTable.last_edited,
        last_copied: entriesTable.last_copied,
      });
    entryRow = updated[0] ?? null;
  } catch (error) {
    console.error("[Entries PUT] Database error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!entryRow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await logAuditEvent({
    userId,
    eventType: "entry_updated",
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    metadata: { entryId: entryRow.id },
  });

  try {
    const entry = {
      ...entryRow,
      ...(await decryptEntryFields(entryRow, encryptionKey)),
    };
    return NextResponse.json({ entry });
  } catch (decryptError) {
    console.error("[Entries PUT] Decrypt error:", decryptError instanceof Error ? decryptError.message : "unknown");
    return NextResponse.json({ error: "decrypt" }, { status: 400 });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const { id } = await context.params;

  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId } = session;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const verification = await getUserVerificationStatus(userId);
  if (verification.status === "error") {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  if (verification.status === "missing") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (verification.status === "unverified") {
    return NextResponse.json(
      { error: "unverified", email: verification.email },
      { status: 403 },
    );
  }
  const userIdForQuery = userId;
  const entryId = id;
  if (!entryId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Rate limit entry writes per user
  const deleteRateLimit = await checkRateLimit(userId, ENTRY_WRITE_RATE_LIMIT);
  if (!deleteRateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    await db
      .delete(entriesTable)
      .where(
        and(
          eq(entriesTable.id, entryId),
          eq(entriesTable.user_id, userIdForQuery),
        ),
      );
  } catch (error) {
    console.error("[Entries DELETE] Database error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  await logAuditEvent({
    userId,
    eventType: "entry_deleted",
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    metadata: { entryId },
  });

  return NextResponse.json({ ok: true });
}
