import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deriveEntryKey,
  encryptEntryFields,
  decryptEntryFields,
  requireSessionUserId,
  type EntryRow,
} from "@/lib/entries/crypto";

const entrySelect =
  "id, user_id, created_at, nombre, usuario, contrasena, last_edited, last_copied";

export async function GET(req: Request) {
  const userId = await requireSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const masterPassword = req.headers.get("x-master-password") ?? "";
  if (!masterPassword) {
    return NextResponse.json({ error: "missing_master" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("entries")
    .select(entrySelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  const key = await deriveEntryKey(masterPassword);

  try {
    const entries = await Promise.all(
      (data ?? []).map(async (entry: EntryRow) => ({
        ...entry,
        ...(await decryptEntryFields(entry, key)),
      })),
    );

    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "decrypt" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const userId = await requireSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const masterPassword = String(body?.masterPassword ?? "");
  if (!masterPassword) {
    return NextResponse.json({ error: "missing_master" }, { status: 400 });
  }

  const nombre = String(body?.nombre ?? "").trim();
  const usuario = String(body?.usuario ?? "").trim();
  const contrasena = String(body?.contrasena ?? "");
  if (!nombre || !usuario || !contrasena) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const key = await deriveEntryKey(masterPassword);
  const encryptedFields = await encryptEntryFields(
    { nombre, usuario, contrasena },
    key,
  );

  const now = new Date().toISOString();
  const createdAt = typeof body?.created_at === "string" ? body.created_at : now;
  const lastEdited =
    typeof body?.last_edited === "string" ? body.last_edited : createdAt;
  const lastCopied =
    typeof body?.last_copied === "string" ? body.last_copied : null;
  const entryId =
    typeof body?.id === "string" && body.id ? body.id : crypto.randomUUID();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("entries")
    .insert({
      id: entryId,
      user_id: userId,
      created_at: createdAt,
      last_edited: lastEdited,
      last_copied: lastCopied,
      ...encryptedFields,
    })
    .select(entrySelect)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  try {
    const entry = {
      ...data,
      ...(await decryptEntryFields(data, key)),
    };
    return NextResponse.json({ entry }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "decrypt" }, { status: 400 });
  }
}
