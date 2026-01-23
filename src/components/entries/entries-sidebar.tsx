"use client";

import type { Entry } from "@/types/entries";

type EntriesSidebarProps = {
  entries: Entry[];
  filteredEntries: Entry[];
  activeId: string | null;
  query: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSelectEntry: (id: string) => void;
  onCreate: () => void;
};

export default function EntriesSidebar({
  entries,
  filteredEntries,
  activeId,
  query,
  loading,
  onQueryChange,
  onSelectEntry,
  onCreate,
}: EntriesSidebarProps) {
  return (
    <aside className="flex flex-col rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]">
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
            Entries
          </p>
          <p className="text-2xl font-semibold">{entries.length}</p>
        </div>
        <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
          {query ? `${filteredEntries.length} results` : "All"}
        </span>
      </div>

      <div className="px-5 py-4">
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
          Search
        </label>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Site, username, link"
          className="mt-2 w-full rounded-full border border-[color:var(--border)] bg-transparent px-4 py-2 text-sm outline-none transition focus:border-[color:var(--accent)]"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <p className="px-3 py-4 text-sm text-[color:var(--muted-foreground)]">
            Loading...
          </p>
        ) : filteredEntries.length === 0 ? (
          <div className="px-3 py-6 text-sm text-[color:var(--muted-foreground)]">
            No entries yet.
            <button
              onClick={onCreate}
              className="mt-4 w-full rounded-full border border-dashed border-[color:var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition hover:border-[color:var(--accent)]"
            >
              Create the first one
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredEntries.map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => onSelectEntry(String(entry.id))}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    activeId === String(entry.id)
                      ? "border-[color:var(--accent)] bg-[color:var(--muted)]"
                      : "border-transparent hover:border-[color:var(--border)]"
                  }`}
                >
                  <p className="text-sm font-semibold truncate">{entry.name}</p>
                  <p className="text-xs text-[color:var(--muted-foreground)] truncate">
                    {entry.url || "No link"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
