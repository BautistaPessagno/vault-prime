"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Entry = {
  id: string | number;
  user_id: string | number | null;
  created_at: string;
  nombre: string;
  usuario: string; // Used as Link/Username
  password: string;
  last_edited: string | null;
  last_copied: string | null;
};

type EntryDraft = {
  nombre: string;
  usuario: string;
  password: string;
};

const emptyDraft: EntryDraft = {
  nombre: "",
  usuario: "",
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
  const [copyFlag, setCopyFlag] = useState<{ id: Entry["id"]; at: string } | null>(null);

  const router = useRouter();

  const activeEntry = entries.find((entry) => String(entry.id) === activeId) ?? null;

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return entries;
    }
    return entries.filter((entry) => {
      return (
        entry.nombre.toLowerCase().includes(normalized) ||
        entry.usuario.toLowerCase().includes(normalized)
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

  // Auto-load entries on mount (encryption key is stored in session)
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
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
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
      password: activeEntry.password,
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setDraft(emptyDraft);
  };

  const persistEntry = async (
    entry: Partial<Entry> & { nombre: string; usuario: string; password: string },
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
      setNotice("Nombre y contraseña son requeridos.");
      return;
    }

    const now = new Date().toISOString();

    if (isCreating) {
      const newEntryData = {
        nombre: draft.nombre.trim(),
        usuario: draft.usuario.trim(),
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
        password: draft.password,
        last_edited: now,
      };
      setIsEditing(false);
      setDraft(emptyDraft);
      
      const savedEntry = await persistEntry(updated, "update");
      if (savedEntry) {
        setEntries((prev) =>
          prev.map((entry) => (entry.id === savedEntry.id ? savedEntry : entry)),
        );
        setNotice("Entrada actualizada.");
      }
    }
  };

  const handleDelete = async () => {
    if (!activeEntry) return;
    if (!window.confirm(`¿Eliminar ${activeEntry.nombre}?`)) return;
    
    const targetId = activeEntry.id;
    setEntries((prev) => prev.filter((entry) => entry.id !== targetId));
    setActiveId(null);
    await persistEntry(activeEntry, "delete");
    setNotice("Entrada eliminada.");
  };

  const handleCopy = async (text: string, label: string, entryId: Entry["id"]) => {
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

  // Show loading state while checking authentication
  if (loading && entries.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white text-gray-900">
      {/* Sidebar - List View */}
      <aside className="flex w-80 flex-col border-r border-gray-200 bg-gray-50">
        <div className="flex flex-col gap-4 p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-800">Mis Entradas</h1>
            <button
              onClick={handleCreate}
              className="rounded-md bg-teal-600 p-1.5 text-white hover:bg-teal-700"
              title="Crear nueva entrada"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-gray-500">Cargando...</p>
          ) : filteredEntries.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No hay entradas.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredEntries.map((entry) => (
                <li key={entry.id}>
                  <button
                    onClick={() => {
                      setActiveId(String(entry.id));
                      setIsCreating(false);
                      setIsEditing(false);
                    }}
                    className={`block w-full px-4 py-3 text-left hover:bg-gray-100 ${
                      activeId === String(entry.id) ? "bg-teal-50 border-l-4 border-teal-600" : ""
                    }`}
                  >
                    <p className="font-medium text-gray-900 truncate">{entry.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">{entry.usuario || "Sin link"}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content - Detail View */}
      <main className="flex-1 overflow-y-auto bg-white p-8">
        {notice && (
          <div className="fixed top-4 right-4 z-50 rounded-md bg-gray-800 px-4 py-2 text-sm text-white shadow-lg">
            {notice}
          </div>
        )}

        {isCreating || isEditing ? (
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">
              {isCreating ? "Nueva Entrada" : "Editar Entrada"}
            </h2>
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  type="text"
                  value={draft.nombre}
                  onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                  placeholder="Nombre del sitio"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Link / Usuario</label>
                <input
                  type="text"
                  value={draft.usuario}
                  onChange={(e) => setDraft({ ...draft, usuario: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                  placeholder="https://ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    value={draft.password}
                    onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-teal-500"
                  />
                  <button
                     type="button"
                     onClick={() => setDraft({ ...draft, password: Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10) })}
                     className="absolute right-2 top-2 text-xs text-teal-600 hover:text-teal-800"
                  >
                    Generar
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        ) : activeEntry ? (
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-900">{activeEntry.nombre}</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Editar
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </div>

            <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Link</label>
                <div className="mt-1 flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                   <a href={activeEntry.usuario.startsWith('http') ? activeEntry.usuario : `https://${activeEntry.usuario}`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline truncate mr-2">
                     {activeEntry.usuario}
                   </a>
                   <button
                     onClick={() => handleCopy(activeEntry.usuario, "Link", activeEntry.id)}
                     className="text-gray-400 hover:text-gray-600"
                     title="Copiar"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                   </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contraseña</label>
                <div className="mt-1 flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                  <span className="font-mono text-gray-900 truncate mr-2">
                    {showPassword ? activeEntry.password : "••••••••••••••••"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600"
                      title={showPassword ? "Ocultar" : "Mostrar"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleCopy(activeEntry.password, "Contraseña", activeEntry.id)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Copiar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path></svg>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Última copia</label>
                <div className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {formatLastCopied(activeEntry.last_copied)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <p className="mt-4 text-lg font-medium text-gray-500">Selecciona una entrada</p>
          </div>
        )}
      </main>
    </div>
  );
}
