import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionData } from "@/lib/entries/crypto";

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
  const userIdForQuery = /^\d+$/.test(userId) ? parseInt(userId, 10) : userId;

  const body = await req.json().catch(() => null);
  const lastCopied =
    typeof body?.last_copied === "string"
      ? body.last_copied
      : new Date().toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("entries")
    .update({ last_copied: lastCopied })
    .eq("id", id)
    .eq("user_id", userIdForQuery)
    .select("id, last_copied")
    .maybeSingle();

  if (error || !data) {
    console.error("[Entries Copied] Database error:", error);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ entry: data });
}
