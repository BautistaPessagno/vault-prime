import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { verifySessionToken } from "@/src/lib/auth/jwt";
import { db } from "@/src/db";
import { entriesTable } from "@/src/db/schema";

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let userId: string;
  try {
    const payload = await verifySessionToken(token);
    const sub = payload.sub != null ? String(payload.sub) : null;
    if (!sub) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    userId = sub;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

    return NextResponse.json({ entries });
  } catch (error) {
    console.error(
      "[Extension Entries] Database error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
}
