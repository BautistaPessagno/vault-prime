import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSessionData,
  encryptEntryFields,
  decryptEntryFields,
  type EntryRow,
} from "@/lib/entries/crypto";

const entrySelect =
  'id, user_id, created_at, nombre, usuario, "password", last_edited, last_copied';

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
  // Convert userId to number if it's numeric (for integer PKs in database)
  const userIdForQuery = /^\d+$/.test(userId) ? parseInt(userId, 10) : userId;

  const body = await req.json().catch(() => null);

  const nombre = String(body?.nombre ?? "").trim();
  const usuario = String(body?.usuario ?? "").trim();
  const password = String(body?.password ?? "");
  if (!nombre || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const encryptedFields = await encryptEntryFields(
    { nombre, usuario, password },
    encryptionKey,
  );

  const updates: Partial<EntryRow> = {
    ...encryptedFields,
  };

  if (typeof body?.last_edited === "string") {
    updates.last_edited = body.last_edited;
  }

  if (typeof body?.last_copied === "string" || body?.last_copied === null) {
    updates.last_copied = body.last_copied;
  }

  const supabase = createAdminClient();
  const { data: entryData, error } = await supabase
    .from("entries")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userIdForQuery)
    .select(entrySelect)
    .maybeSingle();
  const entryRow = entryData as EntryRow | null;

  if (error || !entryRow) {
    console.error("[Entries PUT] Database error:", error);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const entry = {
      ...entryRow,
      ...(await decryptEntryFields(entryRow, encryptionKey)),
    };
    return NextResponse.json({ entry });
  } catch (decryptError) {
    console.error("[Entries PUT] Decrypt error:", decryptError);
    return NextResponse.json({ error: "decrypt" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId } = session;
  // Convert userId to number if it's numeric (for integer PKs in database)
  const userIdForQuery = /^\d+$/.test(userId) ? parseInt(userId, 10) : userId;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userIdForQuery);

  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
