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

function noStore<T extends NextResponse>(res: T): T {
  res.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private, max-age=0",
  );
  res.headers.set("Pragma", "no-cache");
  return res;
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSessionData();
  if (!session) {
    return noStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }

  const { userId, encryptionKey } = session;
  if (!userId) {
    return noStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }

  const verification = await getUserVerificationStatus(userId);
  if (verification.status === "error") {
    return noStore(NextResponse.json({ error: "db" }, { status: 500 }));
  }
  if (verification.status === "missing") {
    return noStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }
  if (verification.status === "unverified") {
    return noStore(
      NextResponse.json(
        { error: "unverified", email: verification.email },
        { status: 403 },
      ),
    );
  }
  const userIdForQuery = userId;
  const entryId = id;
  if (!entryId) {
    return noStore(NextResponse.json({ error: "not_found" }, { status: 404 }));
  }

  // Rate limit entry writes per user
  const rateLimit = await checkRateLimit(userId, ENTRY_WRITE_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return noStore(NextResponse.json({ error: "rate_limited" }, { status: 429 }));
  }

  const body = await req.json().catch(() => null);

  const parseResult = entrySchema.safeParse(body);
  if (!parseResult.success) {
    return noStore(
      NextResponse.json(
        { error: "validation", errors: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      ),
    );
  }
  const { name, username, password, url } = parseResult.data;

  const encryptedFields = await encryptEntryFields(
    { name, username, password, url },
    encryptionKey,
  );

  const updates: Partial<InsertEntry> = {
    ...encryptedFields,
    last_edited: new Date().toISOString(),
  };

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
    return noStore(NextResponse.json({ error: "not_found" }, { status: 404 }));
  }

  if (!entryRow) {
    return noStore(NextResponse.json({ error: "not_found" }, { status: 404 }));
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
    return noStore(NextResponse.json({ entry }));
  } catch (decryptError) {
    console.error("[Entries PUT] Decrypt error:", decryptError instanceof Error ? decryptError.message : "unknown");
    return noStore(NextResponse.json({ error: "decrypt" }, { status: 400 }));
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const { id } = await context.params;

  const session = await getSessionData();
  if (!session) {
    return noStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }

  const { userId } = session;
  if (!userId) {
    return noStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }

  const verification = await getUserVerificationStatus(userId);
  if (verification.status === "error") {
    return noStore(NextResponse.json({ error: "db" }, { status: 500 }));
  }
  if (verification.status === "missing") {
    return noStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }
  if (verification.status === "unverified") {
    return noStore(
      NextResponse.json(
        { error: "unverified", email: verification.email },
        { status: 403 },
      ),
    );
  }
  const userIdForQuery = userId;
  const entryId = id;
  if (!entryId) {
    return noStore(NextResponse.json({ error: "not_found" }, { status: 404 }));
  }

  // Rate limit entry writes per user
  const deleteRateLimit = await checkRateLimit(userId, ENTRY_WRITE_RATE_LIMIT);
  if (!deleteRateLimit.allowed) {
    return noStore(NextResponse.json({ error: "rate_limited" }, { status: 429 }));
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
    return noStore(NextResponse.json({ error: "db" }, { status: 500 }));
  }

  await logAuditEvent({
    userId,
    eventType: "entry_deleted",
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    metadata: { entryId },
  });

  return noStore(NextResponse.json({ ok: true }));
}
