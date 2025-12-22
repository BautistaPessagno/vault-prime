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

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PUT(req: Request, context: RouteContext) {
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
  const { data, error } = await supabase
    .from("entries")
    .update(updates)
    .eq("id", context.params.id)
    .eq("user_id", userId)
    .select(entrySelect)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const entry = {
      ...data,
      ...(await decryptEntryFields(data, key)),
    };
    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json({ error: "decrypt" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const userId = await requireSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("id", context.params.id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
