import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
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

export async function GET() {
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

  let entryRows: EntryRow[] = [];
  try {
    entryRows = await db
      .select({
        id: entriesTable.id,
        user_id: entriesTable.user_id,
        name: entriesTable.name,
        username: entriesTable.username,
        password: entriesTable.password,
        url: entriesTable.url,
        created_at: entriesTable.created_at,
        last_edited: entriesTable.last_edited,
        last_copied: entriesTable.last_copied,
      })
      .from(entriesTable)
      .where(eq(entriesTable.user_id, userIdForQuery))
      .orderBy(desc(entriesTable.last_edited), desc(entriesTable.id));
  } catch (error) {
    console.error("[Entries] Database error:", error instanceof Error ? error.message : "unknown");
    return noStore(NextResponse.json({ error: "db" }, { status: 500 }));
  }

  try {
    const entries = await Promise.all(
      entryRows.map(async (entry) => ({
        ...entry,
        ...(await decryptEntryFields(entry, encryptionKey)),
      })),
    );

    return noStore(NextResponse.json({ entries }));
  } catch {
    return noStore(NextResponse.json({ error: "decrypt" }, { status: 400 }));
  }
}

export async function POST(req: Request) {
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

  let entryRow: EntryRow | null = null;
  try {
    const values: InsertEntry = {
      user_id: userIdForQuery,
      last_edited: new Date().toISOString(),
      ...encryptedFields,
    };

    const inserted = await db.insert(entriesTable).values(values).returning({
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
    entryRow = inserted[0] ?? null;
  } catch (error) {
    console.error("[Entries POST] Database error:", error instanceof Error ? error.message : "unknown");
    return noStore(NextResponse.json({ error: "db" }, { status: 500 }));
  }

  if (!entryRow) {
    return noStore(NextResponse.json({ error: "db" }, { status: 500 }));
  }

  await logAuditEvent({
    userId,
    eventType: "entry_created",
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    metadata: { entryId: entryRow.id },
  });

  try {
    const entry = {
      ...entryRow,
      ...(await decryptEntryFields(entryRow, encryptionKey)),
    };
    return noStore(NextResponse.json({ entry }, { status: 201 }));
  } catch (decryptError) {
    console.error("[Entries POST] Decrypt error:", decryptError instanceof Error ? decryptError.message : "unknown");
    return noStore(NextResponse.json({ error: "decrypt" }, { status: 400 }));
  }
}
