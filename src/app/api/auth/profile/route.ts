import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { usersTable } from "@/src/db/schema";
import { getSessionData } from "@/src/lib/entries/crypto";

export async function GET() {
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        email: usersTable.email,
        created_at: usersTable.created_at,
      })
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);
    const profile = rows[0];

    if (!profile) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      email: profile.email,
      createdAt: profile.created_at ?? null,
    });
  } catch (error) {
    console.error("[Auth Profile] Database error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
}
