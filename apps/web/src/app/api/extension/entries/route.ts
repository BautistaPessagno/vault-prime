import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { verifySessionToken } from "@/src/lib/auth/jwt";
import { db } from "@/src/db";
import { entriesTable } from "@/src/db/schema";
import { getUserVerificationStatus } from "@/src/lib/auth/verify-user";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import {
  logAuditEvent,
  getClientIp,
  getUserAgent,
} from "@/src/lib/security/audit-log";

const EXT_ENTRIES_READ_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxAttempts: 60,
  keyPrefix: "ratelimit:ext-entries:read:",
};

function noStore<T extends NextResponse>(res: T): T {
  res.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private, max-age=0",
  );
  res.headers.set("Pragma", "no-cache");
  return res;
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return noStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  }

  let userId: string;
  try {
    const payload = await verifySessionToken(token);
    const sub = payload.sub != null ? String(payload.sub) : null;
    if (!sub) {
      return noStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
    }
    userId = sub;
  } catch {
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

  const rateLimit = await checkRateLimit(userId, EXT_ENTRIES_READ_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return noStore(NextResponse.json({ error: "rate_limited" }, { status: 429 }));
  }

  try {
    const entries = await db
      .select({
        id: entriesTable.id,
        name: entriesTable.name,
        username: entriesTable.username,
        password: entriesTable.password,
        url: entriesTable.url,
        created_at: entriesTable.created_at,
        last_edited: entriesTable.last_edited,
        last_copied: entriesTable.last_copied,
      })
      .from(entriesTable)
      .where(eq(entriesTable.user_id, userId))
      .orderBy(desc(entriesTable.last_edited), desc(entriesTable.id));

    await logAuditEvent({
      userId,
      eventType: "extension_entries_read",
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { count: entries.length },
    });

    return noStore(NextResponse.json({ entries }));
  } catch (error) {
    console.error(
      "[Extension Entries] Database error:",
      error instanceof Error ? error.message : "unknown",
    );
    return noStore(NextResponse.json({ error: "db" }, { status: 500 }));
  }
}
