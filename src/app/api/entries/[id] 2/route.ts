import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { entriesTable, type InsertEntry } from "@/src/db/schema";
import {
  getSessionData,
  encryptEntryFields,
  decryptEntryFields,
  type EntryRow,
} from "@/src/lib/entries/crypto";

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
  const userIdForQuery = Number.parseInt(userId, 10);
  if (!Number.isFinite(userIdForQuery)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const entryId = Number.parseInt(id, 10);
  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);

  const nombre = String(body?.nombre ?? "").trim();
  const usuario = String(body?.usuario ?? "").trim();
  const password = String(body?.password ?? "");
  const url = String(body?.url ?? usuario).trim();
  if (!nombre || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const encryptedFields = await encryptEntryFields(
    { nombre, usuario, password, url },
    encryptionKey,
  );

  const updates: Partial<InsertEntry> = { ...encryptedFields };

  if (typeof body?.last_edited === "string") {
    updates.last_edited = body.last_edited;
  }

  if (typeof body?.last_copied === "string") {
    updates.last_copied = body.last_copied;
  }

  let entryRow: EntryRow | null = null;
  try {
    const updated = await db
      .update(entriesTable)
      .set(updates)
      .where(
        and(
          eq(entriesTable.id, entryId),
          eq(entriesTable.user_id, userIdForQuery),
        ),
      )
      .returning({
        id: entriesTable.id,
        user_id: entriesTable.user_id,
        nombre: entriesTable.nombre,
        usuario: entriesTable.usuario,
        password: entriesTable.password,
        url: entriesTable.url,
        last_edited: entriesTable.last_edited,
        last_copied: entriesTable.last_copied,
      });
    entryRow = updated[0] ?? null;
  } catch (error) {
    console.error("[Entries PUT] Database error:", error);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!entryRow) {
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
  const userIdForQuery = Number.parseInt(userId, 10);
  if (!Number.isFinite(userIdForQuery)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const entryId = Number.parseInt(id, 10);
  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await db
      .delete(entriesTable)
      .where(
        and(
          eq(entriesTable.id, entryId),
          eq(entriesTable.user_id, userIdForQuery),
        ),
      );
  } catch (error) {
    console.error("[Entries DELETE] Database error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
