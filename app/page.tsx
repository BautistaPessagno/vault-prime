"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Entry = {
  id: string;
  user_id: string | null;
  created_at: string;
  nombre: string;
  usuario: string;
  contrasena: string;
  last_edited: string | null;
  last_copied: string | null;
};

type EntryDraft = {
  nombre: string;
  usuario: string;
  contrasena: string;
};

const emptyDraft: EntryDraft = {
  nombre: "",
  usuario: "",
  contrasena: "",
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-AR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [masterKey, setMasterKey] = useState("");
  const [showMaster, setShowMaster] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<
    "locked" | "unlocking" | "unlocked"
  >("locked");
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);
  const [showPassword, setShowPassword] = useState(false);

  const activeEntry = entries.find((entry) => entry.id === activeId) ?? null;
  const isLocked = vaultStatus !== "unlocked";

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

  const unlockWithPassword = async (password: string) => {
    if (!password.trim()) {
      setVaultError("Ingresa la clave maestra para desbloquear.");
      return;
    }
    setVaultError(null);
    setVaultStatus("unlocking");
    setMasterKey(password);
    const ok = await loadEntries(password);
    if (!ok) {
      setVaultStatus("locked");
      return;
    }
    sessionStorage.setItem("vault_master_password", password);
    setVaultStatus("unlocked");
    setNotice("Vault desbloqueado.");
  };

  useEffect(() => {
    const saved = sessionStorage.getItem("vault_master_password");
    if (!saved) {
      return;
    }
    unlockWithPassword(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEntries = async (masterPassword: string): Promise<boolean> => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch("/api/entries", {
        headers: {
          "x-master-password": masterPassword,
        },
        cache: "no-store",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (payload.error === "decrypt") {
          setVaultError("Clave incorrecta o datos corruptos.");
          setEntries([]);
          return false;
        }
        if (res.status === 401) {
          setApiError("Sesion expirada. Inicia sesion.");
          setEntries([]);
          return false;
        }
        throw new Error("db");
      }
      const payload = (await res.json()) as { entries?: Entry[] };
      const incoming = payload.entries ?? [];
      setEntries(incoming);
      setActiveId(incoming[0]?.id ?? null);
      return true;
    } catch (error) {
      setEntries([]);
      setApiError("No se pudo cargar la lista desde la base.");
      return true;
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    try {
      await unlockWithPassword(masterKey);
    } catch (error) {
      setVaultStatus("locked");
      setVaultError("No se pudo desbloquear. Revisa la clave.");
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem("vault_master_password");
    setEntries([]);
    setActiveId(null);
    setIsCreating(false);
    setIsEditing(false);
    setDraft(emptyDraft);
    setVaultStatus("locked");
    setNotice("Vault bloqueado.");
  };

  const handleCreate = () => {
    if (isLocked) {
      return;
    }
    setIsCreating(true);
    setIsEditing(false);
    setDraft(emptyDraft);
    setActiveId(null);
  };

  const handleEdit = () => {
    if (!activeEntry || isLocked) {
      return;
    }
    setIsEditing(true);
    setIsCreating(false);
    setDraft({
      nombre: activeEntry.nombre,
      usuario: activeEntry.usuario,
      contrasena: activeEntry.contrasena,
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setDraft(emptyDraft);
  };

  const persistEntry = async (
    entry: Entry,
    mode: "create" | "update" | "delete",
  ) => {
    if (mode !== "delete" && !masterKey.trim()) {
      setVaultError("Ingresa la clave maestra para guardar.");
      return;
    }
    setApiError(null);
    try {
      const url =
        mode === "create" ? "/api/entries" : `/api/entries/${entry.id}`;
      const payload =
        mode === "delete"
          ? null
          : {
              id: entry.id,
              nombre: entry.nombre,
              usuario: entry.usuario,
              contrasena: entry.contrasena,
              created_at: entry.created_at,
              last_edited: entry.last_edited,
              last_copied: entry.last_copied,
              masterPassword: masterKey,
            };
      const res = await fetch(url, {
        method:
          mode === "create" ? "POST" : mode === "delete" ? "DELETE" : "PUT",
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      if (!res.ok) {
        throw new Error("db");
      }
    } catch (error) {
      setApiError("No se pudo sincronizar con la base de datos.");
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!masterKey.trim()) {
      setVaultError("Ingresa la clave maestra para guardar.");
      return;
    }
    if (!draft.nombre.trim() || !draft.usuario.trim() || !draft.contrasena) {
      setVaultError("Completa nombre, usuario y contrasena.");
      return;
    }
    setVaultError(null);
    const now = new Date().toISOString();

    if (isCreating) {
      const newEntry: Entry = {
        id: crypto.randomUUID(),
        user_id: null,
        created_at: now,
        last_edited: now,
        last_copied: null,
        nombre: draft.nombre.trim(),
        usuario: draft.usuario.trim(),
        contrasena: draft.contrasena,
      };
      setEntries((prev) => [newEntry, ...prev]);
      setActiveId(newEntry.id);
      setIsCreating(false);
      setDraft(emptyDraft);
      await persistEntry(newEntry, "create");
      setNotice("Entrada creada y cifrada.");
      return;
    }

    if (isEditing && activeEntry) {
      const updated: Entry = {
        ...activeEntry,
        nombre: draft.nombre.trim(),
        usuario: draft.usuario.trim(),
        contrasena: draft.contrasena,
        last_edited: now,
      };
      setEntries((prev) =>
        prev.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setIsEditing(false);
      setDraft(emptyDraft);
      await persistEntry(updated, "update");
      setNotice("Entrada actualizada.");
    }
  };

  const handleDelete = async () => {
    if (!activeEntry || isLocked) {
      return;
    }
    const confirmed = window.confirm(
      `Eliminar ${activeEntry.nombre}? Esta accion no se puede deshacer.`,
    );
    if (!confirmed) {
      return;
    }
    const targetId = activeEntry.id;
    setEntries((prev) => prev.filter((entry) => entry.id !== targetId));
    setActiveId((prev) => (prev === targetId ? null : prev));
    await persistEntry(activeEntry, "delete");
    setNotice("Entrada eliminada.");
  };

  const handleCopy = async (
    entry: Entry,
    field: "usuario" | "contrasena" | "login",
  ) => {
    const payload =
      field === "login"
        ? `${entry.usuario}\t${entry.contrasena}`
        : entry[field];
    try {
      await navigator.clipboard.writeText(payload);
      setNotice(
        field === "login"
          ? "Login copiado."
          : field === "usuario"
            ? "Usuario copiado."
            : "Contrasena copiada.",
      );
    } catch (error) {
      setNotice("No se pudo copiar al portapapeles.");
    }

    const now = new Date().toISOString();
    const updated: Entry = { ...entry, last_copied: now };
    setEntries((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    await persistEntry(updated, "update");
  };

  const statusLabel =
    vaultStatus === "unlocked"
      ? "Desbloqueado"
      : vaultStatus === "unlocking"
        ? "Desbloqueando..."
        : "Bloqueado";

  return (
    <div className="min-h-screen bg-[#f5efe6] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-[-10%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.35),transparent_70%)]" />
        <div className="absolute bottom-[-20%] left-[-10%] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.22),transparent_70%)]" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-teal-700">
              Vault Prime
            </p>
            <h1 className="text-4xl font-semibold text-slate-900 md:text-5xl">
              Password Desk
            </h1>
            <p className="max-w-xl text-sm text-slate-600">
              Gestiona entradas cifradas con un flujo master-detail para crear,
              editar y copiar credenciales rapidamente.
            </p>
          </div>

          <div className="w-full rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_24px_60px_-40px_rgba(15,118,110,0.65)] backdrop-blur md:w-[360px]">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Clave maestra
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type={showMaster ? "text" : "password"}
                value={masterKey}
                onChange={(event) => setMasterKey(event.target.value)}
                placeholder="Tu frase secreta"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
              <button
                type="button"
                onClick={() => setShowMaster((prev) => !prev)}
                className="rounded-xl border border-slate-200 px-3 text-xs text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                {showMaster ? "Ocultar" : "Mostrar"}
              </button>
              <button
                type="button"
                onClick={handleUnlock}
                className="rounded-xl bg-teal-700 px-4 text-xs font-semibold text-white transition hover:bg-teal-800"
              >
                Unlock
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Estado: {statusLabel}</span>
              {vaultStatus === "unlocked" ? (
                <button
                  type="button"
                  onClick={handleLock}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                >
                  Lock
                </button>
              ) : null}
            </div>
            {vaultError ? (
              <p className="mt-2 text-xs text-rose-600">{vaultError}</p>
            ) : null}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(360px,1.1fr)]">
          <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/85 shadow-[0_30px_70px_-50px_rgba(15,118,110,0.5)] backdrop-blur">
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Entradas
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Sitios guardados
                </h2>
                <p className="text-xs text-slate-500">
                  {filteredEntries.length} sitios
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isLocked}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Nueva entrada
              </button>
            </div>

            <div className="px-5 pb-4">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o usuario"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
            </div>

            <div className="border-t border-slate-200">
              <div className="max-h-[420px] overflow-auto">
                {isLocked ? (
                  <div className="px-5 py-10 text-sm text-slate-500">
                    Desbloquea el vault para ver las entradas.
                  </div>
                ) : loading ? (
                  <div className="px-5 py-10 text-sm text-slate-500">
                    Cargando entradas...
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="px-5 py-10 text-sm text-slate-500">
                    No hay entradas aun. Crea la primera.
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Sitio</th>
                        <th className="px-4 py-3">Usuario</th>
                        <th className="px-4 py-3">Editado</th>
                        <th className="px-4 py-3">Copiado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => {
                        const isActive = entry.id === activeId;
                        return (
                          <tr
                            key={entry.id}
                            onClick={() => setActiveId(entry.id)}
                            className={`cursor-pointer border-t border-slate-100 transition hover:bg-teal-50/60 ${
                              isActive ? "bg-teal-50/80" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {entry.nombre}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {entry.usuario}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {formatDate(
                                entry.last_edited ?? entry.created_at,
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {formatDate(entry.last_copied)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_30px_70px_-50px_rgba(14,116,144,0.5)] backdrop-blur">
            <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.2),transparent_65%)]" />
            <div className="relative">
              {notice ? (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                  {notice}
                </div>
              ) : null}
              {apiError ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                  {apiError}
                </div>
              ) : null}

              {isLocked ? (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Detalle
                  </p>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    Vault bloqueado
                  </h3>
                  <p className="text-sm text-slate-600">
                    Desbloquea para visualizar, editar y copiar tus credenciales
                    cifradas.
                  </p>
                </div>
              ) : isCreating || isEditing ? (
                <form onSubmit={handleSave} className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        {isCreating ? "Nueva entrada" : "Editar entrada"}
                      </p>
                      <h3 className="text-2xl font-semibold text-slate-900">
                        {isCreating ? "Crear sitio" : "Actualizar sitio"}
                      </h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                      Datos cifrados
                    </span>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                      Nombre del sitio
                    </label>
                    <input
                      type="text"
                      value={draft.nombre}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          nombre: event.target.value,
                        }))
                      }
                      placeholder="Ej: Banco Central"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                      Usuario
                    </label>
                    <input
                      type="text"
                      value={draft.usuario}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          usuario: event.target.value,
                        }))
                      }
                      placeholder="usuario@email.com"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">
                      Contrasena
                    </label>
                    <input
                      type="text"
                      value={draft.contrasena}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          contrasena: event.target.value,
                        }))
                      }
                      placeholder="Genera una clave segura"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              ) : activeEntry ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        Detalle
                      </p>
                      <h3 className="text-2xl font-semibold text-slate-900">
                        {activeEntry.nombre}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Creado: {formatDate(activeEntry.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleEdit}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Usuario
                      </p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">
                        {activeEntry.usuario}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeEntry, "usuario")}
                        className="mt-3 text-xs font-semibold text-teal-700 hover:text-teal-900"
                      >
                        Copiar usuario
                      </button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Contrasena
                      </p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">
                        {showPassword ? activeEntry.contrasena : "********"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleCopy(activeEntry, "contrasena")}
                          className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                        >
                          Copiar contrasena
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          {showPassword ? "Ocultar" : "Mostrar"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Acciones rapidas
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleCopy(activeEntry, "login")}
                        className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
                      >
                        Copiar login completo
                      </button>
                      <div className="text-xs text-slate-500">
                        Ultima edicion:{" "}
                        <span className="font-semibold text-slate-700">
                          {formatDate(activeEntry.last_edited)}
                        </span>{" "}
                        - Ultima copia:{" "}
                        <span className="font-semibold text-slate-700">
                          {formatDate(activeEntry.last_copied)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Detalle
                  </p>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    Selecciona una entrada
                  </h3>
                  <p className="text-sm text-slate-600">
                    Elige un sitio para ver el detalle o crea uno nuevo.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
