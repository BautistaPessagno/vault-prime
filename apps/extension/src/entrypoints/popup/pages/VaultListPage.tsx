import { useEffect, useMemo, useState } from "react";
import type { DecryptedEntry } from "@/lib/types";
import type { EntriesResponse } from "@/lib/messages";

type Props = {
  onSelectEntry: (entry: DecryptedEntry) => void;
  onLock: () => void;
  onLogout: () => void;
};

export default function VaultListPage({ onSelectEntry, onLock, onLogout }: Props) {
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await browser.runtime.sendMessage({
        action: "getEntries",
      })) as EntriesResponse;
      if (res.ok) {
        setEntries(res.entries);
      } else {
        if (res.error === "locked") {
          onLock();
          return;
        }
        setError("Failed to load entries.");
      }
    } catch {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q),
    );
  }, [entries, query]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="vp-header">
        <span className="vp-header-title">Vault Prime</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onLock}
            title="Lock vault"
            style={{
              background: "none",
              border: "none",
              color: "var(--muted-foreground)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Lock
          </button>
          <button
            onClick={onLogout}
            title="Log out"
            style={{
              background: "none",
              border: "none",
              color: "var(--muted-foreground)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Log out
          </button>
        </div>
      </div>

      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <input
          className="vp-input"
          type="search"
          placeholder="Search entries..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="vp-scrollable">
        {loading ? (
          <p style={{ padding: 16, fontSize: 13, color: "var(--muted-foreground)" }}>Loading entries...</p>
        ) : error ? (
          <div style={{ padding: 16 }}>
            <div className="vp-error">{error}</div>
            <button className="vp-btn vp-btn-ghost" onClick={loadEntries} style={{ marginTop: 8 }}>
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 16, fontSize: 13, color: "var(--muted-foreground)" }}>
            {query ? "No matches." : "No entries yet. Add entries in the web app."}
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: "8px 8px" }}>
            {filtered.map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => onSelectEntry(entry)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "1px solid transparent",
                    borderRadius: 12,
                    padding: "10px 12px",
                    cursor: "pointer",
                    color: "var(--foreground)",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.username || entry.url || "No details"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>
        {entries.length} {entries.length === 1 ? "entry" : "entries"}
      </div>
    </div>
  );
}
