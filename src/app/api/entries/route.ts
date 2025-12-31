import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { entriesTable, type InsertEntry } from "@/src/db/schema";
import {
  getSessionData,
  encryptEntryFields,
  decryptEntryFields,
  type EntryRow,
} from "@/src/lib/entries/crypto";

export async function GET() {
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId, encryptionKey } = session;
  const userIdForQuery = Number.parseInt(userId, 10);
  if (!Number.isFinite(userIdForQuery)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let entryRows: EntryRow[] = [];
  try {
    entryRows = await db
      .select({
        id: entriesTable.id,
        user_id: entriesTable.user_id,
        nombre: entriesTable.nombre,
        usuario: entriesTable.usuario,
        password: entriesTable.password,
        url: entriesTable.url,
        last_edited: entriesTable.last_edited,
        last_copied: entriesTable.last_copied,
      })
      .from(entriesTable)
      .where(eq(entriesTable.user_id, userIdForQuery))
      .orderBy(desc(entriesTable.last_edited), desc(entriesTable.id));
  } catch (error) {
    console.error("[Entries] Database error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  try {
    const entries = await Promise.all(
      entryRows.map(async (entry) => ({
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
  const userIdForQuery = Number.parseInt(userId, 10);
  if (!Number.isFinite(userIdForQuery)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const now = new Date().toISOString();
  const lastEdited =
    typeof body?.last_edited === "string" ? body.last_edited : now;
  const lastCopied =
    typeof body?.last_copied === "string" ? body.last_copied : undefined;

  let entryRow: EntryRow | null = null;
  try {
    const values: InsertEntry = {
      user_id: userIdForQuery,
      last_edited: lastEdited,
      ...encryptedFields,
    };
    if (lastCopied !== undefined) {
      values.last_copied = lastCopied;
    }

    const inserted = await db
      .insert(entriesTable)
      .values(values)
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
    entryRow = inserted[0] ?? null;
  } catch (error) {
    console.error("[Entries POST] Database error:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  if (!entryRow) {
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
