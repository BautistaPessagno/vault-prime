"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Entry = {
  id: string;
  user_id: string | null;
  nombre: string;
  usuario: string;
  url: string;
  password: string;
  last_edited: string | null;
  last_copied: string | null;
};

type EntryDraft = {
  nombre: string;
  usuario: string;
  url: string;
  password: string;
};

const emptyDraft: EntryDraft = {
  nombre: "",
  usuario: "",
  url: "",
  password: "",
};

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [copyFlag, setCopyFlag] = useState<{
    id: Entry["id"];
    at: string;
  } | null>(null);

  const router = useRouter();

  const activeEntry =
    entries.find((entry) => String(entry.id) === activeId) ?? null;

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return entries;
    }
    return entries.filter((entry) => {
      return (
        entry.nombre.toLowerCase().includes(normalized) ||
        entry.usuario.toLowerCase().includes(normalized) ||
        entry.url.toLowerCase().includes(normalized)
      );
    });
  }, [entries, query]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!copyFlag) return;
    const { id, at } = copyFlag;

    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, last_copied: at } : entry,
      ),
    );

    const syncLastCopied = async () => {
      try {
        const res = await fetch(`/api/entries/${id}/copied`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ last_copied: at }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("db");
        const data = (await res.json()) as {
          entry?: { id: Entry["id"]; last_copied: string | null };
        };
        const serverValue = data.entry?.last_copied ?? at;
        if (serverValue !== at) {
          setEntries((prev) =>
            prev.map((entry) =>
              entry.id === id ? { ...entry, last_copied: serverValue } : entry,
            ),
          );
        }
      } catch {
        setNotice("Error al registrar la copia.");
      }
    };

    void syncLastCopied();
    setCopyFlag(null);
  }, [copyFlag]);

  const loadEntries = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch("/api/entries", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return false;
        }
        throw new Error("db");
      }
      const payload = (await res.json()) as { entries?: Entry[] };
      const incoming = payload.entries ?? [];
      setEntries(incoming);
      return true;
    } catch {
      setNotice("Error al cargar las entradas.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setEntries([]);
      setActiveId(null);
      setIsCreating(false);
      setIsEditing(false);
      setDraft(emptyDraft);
      setIsLoggingOut(false);
      router.push("/login");
      router.refresh();
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    setDraft(emptyDraft);
    setActiveId(null);
  };

  const handleEdit = () => {
    if (!activeEntry) return;
    setIsEditing(true);
    setIsCreating(false);
    setDraft({
      nombre: activeEntry.nombre,
      usuario: activeEntry.usuario,
      url: activeEntry.url,
      password: activeEntry.password,
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setDraft(emptyDraft);
  };

  const persistEntry = async (
    entry: Partial<Entry> & {
      nombre: string;
      usuario: string;
      url: string;
      password: string;
    },
    mode: "create" | "update" | "delete",
  ): Promise<Entry | null> => {
    try {
      const url =
        mode === "create" ? "/api/entries" : `/api/entries/${entry.id}`;
      const payload =
        mode === "delete"
          ? null
          : {
              nombre: entry.nombre,
              usuario: entry.usuario,
              url: entry.url,
              password: entry.password,
              last_edited: entry.last_edited,
              last_copied: entry.last_copied,
            };
      const res = await fetch(url, {
        method:
          mode === "create" ? "POST" : mode === "delete" ? "DELETE" : "PUT",
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
        credentials: "include",
      });
      if (!res.ok) throw new Error("db");

      if (mode === "delete") return null;

      const data = await res.json();
      return data.entry as Entry;
    } catch {
      setNotice("Error al guardar cambios.");
      return null;
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.nombre.trim() || !draft.password) {
      setNotice("Nombre y contrasena son requeridos.");
      return;
    }

    const now = new Date().toISOString();

    if (isCreating) {
      const newEntryData = {
        nombre: draft.nombre.trim(),
        usuario: draft.usuario.trim(),
        url: draft.url.trim(),
        password: draft.password,
        last_edited: now,
        last_copied: null,
      };
      setIsCreating(false);
      setDraft(emptyDraft);

      const createdEntry = await persistEntry(newEntryData, "create");
      if (createdEntry) {
        setEntries((prev) => [createdEntry, ...prev]);
        setActiveId(String(createdEntry.id));
        setNotice("Entrada creada.");
      }
    } else if (isEditing && activeEntry) {
      const updated = {
        ...activeEntry,
        nombre: draft.nombre.trim(),
        usuario: draft.usuario.trim(),
        url: draft.url.trim(),
        password: draft.password,
        last_edited: now,
      };
      setIsEditing(false);
      setDraft(emptyDraft);

      const savedEntry = await persistEntry(updated, "update");
      if (savedEntry) {
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === savedEntry.id ? savedEntry : entry,
          ),
        );
        setNotice("Entrada actualizada.");
      }
    }
  };

  const handleDelete = async () => {
    if (!activeEntry) return;
    if (!window.confirm(`Eliminar ${activeEntry.nombre}?`)) return;

    const targetId = activeEntry.id;
    setEntries((prev) => prev.filter((entry) => entry.id !== targetId));
    setActiveId(null);
    await persistEntry(activeEntry, "delete");
    setNotice("Entrada eliminada.");
  };

  const handleCopy = async (
    text: string,
    label: string,
    entryId: Entry["id"],
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copiado.`);
      setCopyFlag({ id: entryId, at: new Date().toISOString() });
    } catch {
      setNotice("No se pudo copiar.");
    }
  };

  const formatLastCopied = (value: string | null) => {
    if (!value) return "Sin copiar";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Sin copiar";
    return parsed.toLocaleString();
  };

  const isErrorNotice = notice
    ? /error|no se pudo|requeridos/i.test(notice)
    : false;

  if (loading && entries.length === 0) {
    return (
      <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-8 py-6 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--accent)] border-t-transparent"></div>
            <p className="mt-4 text-sm text-[color:var(--muted-foreground)]">
              Cargando entradas...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      {notice && (
        <div
          className={`fixed right-6 top-6 z-50 flex items-center gap-3 rounded-xl border bg-[color:var(--card)] px-4 py-3 text-sm shadow-sm animate-[fadeIn_0.15s_ease-out] ${
            isErrorNotice
              ? "border-[color:var(--danger)] text-[color:var(--danger)]"
              : "border-[color:var(--success)] text-[color:var(--success)]"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isErrorNotice
                ? "bg-[color:var(--danger)]"
                : "bg-[color:var(--success)]"
            }`}
          ></span>
          <span>{notice}</span>
        </div>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-4 border-b border-[color:var(--border)] pb-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--muted-foreground)]">
              Vault Prime
            </p>
            <h1 className="text-3xl font-semibold">Mis entradas</h1>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Todo en un solo lugar. Busqueda rapida, copia directa.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCreate}
              className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:brightness-95"
            >
              Nueva entrada
            </button>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoggingOut ? "Saliendo..." : "Cerrar sesion"}
            </button>
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="flex flex-col rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]">
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                  Entradas
                </p>
                <p className="text-2xl font-semibold">{entries.length}</p>
              </div>
              <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
                {query ? `${filteredEntries.length} resultados` : "Todas"}
              </span>
            </div>

            <div className="px-5 py-4">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                Buscar
              </label>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sitio, usuario, enlace"
                className="mt-2 w-full rounded-full border border-[color:var(--border)] bg-transparent px-4 py-2 text-sm outline-none transition focus:border-[color:var(--accent)]"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4">
              {loading ? (
                <p className="px-3 py-4 text-sm text-[color:var(--muted-foreground)]">
                  Cargando...
                </p>
              ) : filteredEntries.length === 0 ? (
                <div className="px-3 py-6 text-sm text-[color:var(--muted-foreground)]">
                  No hay entradas aun.
                  <button
                    onClick={handleCreate}
                    className="mt-4 w-full rounded-full border border-dashed border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition hover:border-[color:var(--accent)]"
                  >
                    Crear la primera
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {filteredEntries.map((entry) => (
                    <li key={entry.id}>
                      <button
                        onClick={() => {
                          setActiveId(String(entry.id));
                          setIsCreating(false);
                          setIsEditing(false);
                        }}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          activeId === String(entry.id)
                            ? "border-[color:var(--accent)] bg-[color:var(--muted)]"
                            : "border-transparent hover:border-[color:var(--border)]"
                        }`}
                      >
                        <p className="text-sm font-semibold truncate">
                          {entry.nombre}
                        </p>
                        <p className="text-xs text-[color:var(--muted-foreground)] truncate">
                          {entry.url || "Sin link"}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
            {isCreating || isEditing ? (
              <div>
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                      Editor
                    </p>
                    <h2 className="text-2xl font-semibold">
                      {isCreating ? "Nueva entrada" : "Editar entrada"}
                    </h2>
                    <p className="text-sm text-[color:var(--muted-foreground)]">
                      Guarda credenciales con claridad.
                    </p>
                  </div>
                </div>
                <form onSubmit={handleSave} className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={draft.nombre}
                        onChange={(e) =>
                          setDraft({ ...draft, nombre: e.target.value })
                        }
                        className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                        placeholder="Nombre del sitio"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                        Link
                      </label>
                      <input
                        type="text"
                        value={draft.url}
                        onChange={(e) =>
                          setDraft({ ...draft, url: e.target.value })
                        }
                        className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                        placeholder="https://ejemplo.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                        Usuario
                      </label>
                      <input
                        type="text"
                        value={draft.usuario}
                        onChange={(e) =>
                          setDraft({ ...draft, usuario: e.target.value })
                        }
                        className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
                        placeholder="usuario@correo.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                        Contrasena
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={draft.password}
                          onChange={(e) =>
                            setDraft({ ...draft, password: e.target.value })
                          }
                          className="w-full rounded-xl border border-[color:var(--border)] bg-transparent px-4 py-3 pr-24 text-sm outline-none transition focus:border-[color:var(--accent)]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              password:
                                Math.random().toString(36).slice(-10) +
                                Math.random().toString(36).slice(-10),
                            })
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)] transition hover:border-[color:var(--accent)]"
                        >
                          Generar
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--accent)]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:brightness-95"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            ) : activeEntry ? (
              <div>
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                      Entrada
                    </p>
                    <h2 className="text-3xl font-semibold">
                      {activeEntry.nombre}
                    </h2>
                    <p className="text-sm text-[color:var(--muted-foreground)]">
                      {activeEntry.url || "Sin link"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleEdit}
                      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--accent)]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={handleDelete}
                      className="rounded-full border border-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] transition hover:brightness-95"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[color:var(--border)] p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                      Link
                    </label>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      {activeEntry.url ? (
                        <a
                          href={
                            activeEntry.url.startsWith("http")
                              ? activeEntry.url
                              : `https://${activeEntry.url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sm font-semibold text-[color:var(--accent)]"
                        >
                          {activeEntry.url}
                        </a>
                      ) : (
                        <span className="text-sm text-[color:var(--muted-foreground)]">
                          Sin link
                        </span>
                      )}
                      <button
                        onClick={() =>
                          handleCopy(activeEntry.url, "Link", activeEntry.id)
                        }
                        className="rounded-full border border-[color:var(--border)] p-2 transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                        title="Copiar"
                        disabled={!activeEntry.url}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[color:var(--border)] p-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                      Usuario
                    </label>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold">
                        {activeEntry.usuario || "Sin usuario"}
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(
                            activeEntry.usuario,
                            "Usuario",
                            activeEntry.id,
                          )
                        }
                        className="rounded-full border border-[color:var(--border)] p-2 transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                        title="Copiar"
                        disabled={!activeEntry.usuario}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[color:var(--border)] p-4 md:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                      Contrasena
                    </label>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-sm">
                        {showPassword
                          ? activeEntry.password
                          : "••••••••••••••••"}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="rounded-full border border-[color:var(--border)] p-2 transition hover:border-[color:var(--accent)]"
                          title={showPassword ? "Ocultar" : "Mostrar"}
                        >
                          {showPassword ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                              <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() =>
                            handleCopy(
                              activeEntry.password,
                              "Contrasena",
                              activeEntry.id,
                            )
                          }
                          className="rounded-full border border-[color:var(--border)] p-2 transition hover:border-[color:var(--accent)]"
                          title="Copiar"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="9"
                              y="9"
                              width="13"
                              height="13"
                              rx="2"
                              ry="2"
                            ></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[color:var(--border)] p-4 md:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
                      Ultima copia
                    </label>
                    <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                      {formatLastCopied(activeEntry.last_copied)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-[color:var(--muted-foreground)]">
                <div className="rounded-full border border-[color:var(--border)] p-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="3"
                      y="11"
                      width="18"
                      height="11"
                      rx="2"
                      ry="2"
                    ></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[color:var(--foreground)]">
                  Selecciona una entrada
                </h3>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  Elige una entrada del panel o crea una nueva.
                </p>
                <button
                  onClick={handleCreate}
                  className="mt-5 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:brightness-95"
                >
                  Crear entrada
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
