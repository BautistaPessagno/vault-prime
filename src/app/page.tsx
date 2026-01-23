"use client";

import EntriesHeader from "@/src/components/entries/entries-header";
import EntriesSidebar from "@/src/components/entries/entries-sidebar";
import EntryDetails from "@/src/components/entries/entry-details";
import EntryEditorForm from "@/src/components/entries/entry-editor-form";
import EntryEmptyState from "@/src/components/entries/entry-empty-state";
import LoadingState from "@/src/components/entries/loading-state";
import NoticeBanner from "@/src/components/entries/notice-banner";
import type { Entry, EntryDraft } from "@/src/types/entries";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

const emptyDraft: EntryDraft = {
  name: "",
  username: "",
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
        entry.name.toLowerCase().includes(normalized) ||
        entry.username.toLowerCase().includes(normalized) ||
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

  const redirectForAuth = async (res: Response): Promise<boolean> => {
    if (res.status === 401) {
      router.push("/login");
      return true;
    }

    if (res.status === 403) {
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        email?: string;
      };
      if (payload.error === "unverified") {
        const emailParam = payload.email
          ? `?email=${encodeURIComponent(payload.email)}`
          : "";
        router.push(`/verify-email${emailParam}`);
        return true;
      }
    }

    return false;
  };

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
        if (!res.ok) {
          if (await redirectForAuth(res)) return;
          throw new Error("db");
        }
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
        setNotice("Error recording copy.");
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
        if (await redirectForAuth(res)) return false;
        throw new Error("db");
      }
      const payload = (await res.json()) as { entries?: Entry[] };
      const incoming = payload.entries ?? [];
      setEntries(incoming);
      return true;
    } catch {
      setNotice("Error loading entries.");
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
      name: activeEntry.name,
      username: activeEntry.username,
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
      name: string;
      username: string;
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
              name: entry.name,
              username: entry.username,
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
      if (!res.ok) {
        if (await redirectForAuth(res)) return null;
        throw new Error("db");
      }

      if (mode === "delete") return null;

      const data = await res.json();
      return data.entry as Entry;
    } catch {
      setNotice("Error saving changes.");
      return null;
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.password) {
      setNotice("Name and password are required.");
      return;
    }

    const now = new Date().toISOString();

    if (isCreating) {
      const newEntryData = {
        name: draft.name.trim(),
        username: draft.username.trim(),
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
        setNotice("Entry created.");
      }
    } else if (isEditing && activeEntry) {
      const updated = {
        ...activeEntry,
        name: draft.name.trim(),
        username: draft.username.trim(),
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
        setNotice("Entry updated.");
      }
    }
  };

  const handleDelete = async () => {
    if (!activeEntry) return;
    if (!window.confirm(`Delete ${activeEntry.name}?`)) return;

    const targetId = activeEntry.id;
    setEntries((prev) => prev.filter((entry) => entry.id !== targetId));
    setActiveId(null);
    await persistEntry(activeEntry, "delete");
    setNotice("Entry deleted.");
  };

  const handleCopy = async (
    text: string,
    label: string,
    entryId: Entry["id"],
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied.`);
      setCopyFlag({ id: entryId, at: new Date().toISOString() });
    } catch {
      setNotice("Could not copy.");
    }
  };

  const formatLastCopied = (value: string | null) => {
    if (!value) return "Not copied";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Not copied";
    return parsed.toLocaleString();
  };

  const isErrorNotice = notice
    ? /error|no se pudo|requeridos/i.test(notice)
    : false;

  if (loading && entries.length === 0) {
    return <LoadingState />;
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <NoticeBanner notice={notice} isError={isErrorNotice} />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <EntriesHeader
          onCreate={handleCreate}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />

        <div className="grid flex-1 gap-6 lg:grid-cols-[280px_1fr]">
          <EntriesSidebar
            entries={entries}
            filteredEntries={filteredEntries}
            activeId={activeId}
            query={query}
            loading={loading}
            onQueryChange={setQuery}
            onSelectEntry={(id) => {
              setActiveId(id);
              setIsCreating(false);
              setIsEditing(false);
            }}
            onCreate={handleCreate}
          />

          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
            {isCreating || isEditing ? (
              <EntryEditorForm
                draft={draft}
                isCreating={isCreating}
                onDraftChange={setDraft}
                onGeneratePassword={() =>
                  setDraft({
                    ...draft,
                    password:
                      Math.random().toString(36).slice(-10) +
                      Math.random().toString(36).slice(-10),
                  })
                }
                onCancel={handleCancel}
                onSubmit={handleSave}
              />
            ) : activeEntry ? (
              <EntryDetails
                entry={activeEntry}
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCopy={handleCopy}
                formatLastCopied={formatLastCopied}
              />
            ) : (
              <EntryEmptyState onCreate={handleCreate} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
