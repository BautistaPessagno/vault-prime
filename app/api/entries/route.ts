import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSessionData,
  encryptEntryFields,
  decryptEntryFields,
  type EntryRow,
} from "@/lib/entries/crypto";

const entrySelect =
  "id, user_id, created_at, nombre, usuario, contraseña, last_edited, last_copied";

export async function GET() {
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId, encryptionKey } = session;
  // Convert userId to number if it's numeric (for integer PKs in database)
  const userIdForQuery = /^\d+$/.test(userId) ? parseInt(userId, 10) : userId;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("entries")
    .select(entrySelect)
    .eq("user_id", userIdForQuery)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Entries] Database error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  try {
    const entries = await Promise.all(
      (data ?? []).map(async (entry: EntryRow) => ({
        ...entry,
        ...(await decryptEntryFields(entry, encryptionKey)),
      })),
    );

    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "decrypt" }, { status: 400 });
  }
}

export async function POST(req: Request) {
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
  const contrasena = String(body?.contrasena ?? "");
  if (!nombre || !contrasena) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const encryptedFields = await encryptEntryFields(
    { nombre, usuario, contrasena },
    encryptionKey,
  );

  const now = new Date().toISOString();
  const lastEdited =
    typeof body?.last_edited === "string" ? body.last_edited : now;
  const lastCopied =
    typeof body?.last_copied === "string" ? body.last_copied : null;

  const supabase = createAdminClient();
  const { data: entryData, error } = await supabase
    .from("entries")
    .insert({
      user_id: userIdForQuery,
      last_edited: lastEdited,
      last_copied: lastCopied,
      ...encryptedFields,
    })
    .select(entrySelect)
    .single();
  const entryRow = entryData as EntryRow | null;

  if (error || !entryRow) {
    console.error("[Entries POST] Database error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  try {
    const entry = {
      ...entryRow,
      ...(await decryptEntryFields(entryRow, encryptionKey)),
    };
    return NextResponse.json({ entry }, { status: 201 });
  } catch (decryptError) {
    console.error("[Entries POST] Decrypt error:", decryptError);
    return NextResponse.json({ error: "decrypt" }, { status: 400 });
  }
}
