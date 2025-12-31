import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { entriesTable } from "@/src/db/schema";
import { getSessionData } from "@/src/lib/entries/crypto";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId } = session;
  const userIdForQuery = Number.parseInt(userId, 10);
  if (!Number.isFinite(userIdForQuery)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const entryId = Number.parseInt(id, 10);
  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const lastCopied =
    typeof body?.last_copied === "string"
      ? body.last_copied
      : new Date().toISOString();

  try {
    const updated = await db
      .update(entriesTable)
      .set({ last_copied: lastCopied })
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
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (error) {
    console.error("[Entries Copied] Database error:", error);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
