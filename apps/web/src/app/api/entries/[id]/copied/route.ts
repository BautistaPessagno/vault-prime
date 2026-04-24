import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { entriesTable } from "@/src/db/schema";
import { getSessionData } from "@/src/lib/entries/crypto";
import { getUserVerificationStatus } from "@/src/lib/auth/verify-user";
import { logAuditEvent, getClientIp, getUserAgent } from "@/src/lib/security/audit-log";
import { checkRateLimit } from "@/src/lib/security/rate-limit";

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

export async function POST(req: Request, context: RouteContext) {
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
  const rateLimit = await checkRateLimit(userId, ENTRY_WRITE_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return noStore(NextResponse.json({ error: "rate_limited" }, { status: 429 }));
  }

  try {
    const updated = await db
      .update(entriesTable)
      .set({ last_copied: new Date().toISOString() })
      .where(
        and(
          eq(entriesTable.id, entryId),
          eq(entriesTable.user_id, userIdForQuery),
        ),
      )
      .returning({
        id: entriesTable.id,
        last_copied: entriesTable.last_copied,
      });
    const entry = updated[0];
    if (!entry) {
      return noStore(NextResponse.json({ error: "not_found" }, { status: 404 }));
    }

    await logAuditEvent({
      userId,
      eventType: "entry_copied",
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { entryId },
    });

    return noStore(NextResponse.json({ entry }));
  } catch (error) {
    console.error("[Entries Copied] Database error:", error instanceof Error ? error.message : "unknown");
    return noStore(NextResponse.json({ error: "not_found" }, { status: 404 }));
  }
}
