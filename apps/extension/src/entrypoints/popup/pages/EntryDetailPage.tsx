import { useState } from "react";
import type { DecryptedEntry } from "@/lib/types";

type Props = {
  entry: DecryptedEntry;
  onBack: () => void;
  onLock: () => void;
};

export default function EntryDetailPage({ entry, onBack, onLock }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied`);
      setTimeout(() => setNotice(null), 2000);
    } catch {
      setNotice("Copy failed");
      setTimeout(() => setNotice(null), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="vp-header">
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "var(--accent)",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          &larr; Back
        </button>
        <button
          onClick={onLock}
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
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {notice && <div className="vp-notice">{notice}</div>}

        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, wordBreak: "break-word" }}>
          {entry.name}
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label className="vp-label">Username</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}>
              {entry.username || "\u2014"}
            </span>
            {entry.username && (
              <CopyButton onClick={() => copyToClipboard(entry.username, "Username")} />
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="vp-label">Password</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}>
              {showPassword ? entry.password : "\u2022".repeat(12)}
            </span>
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: "none",
                border: "none",
                color: "var(--muted-foreground)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
            <CopyButton onClick={() => copyToClipboard(entry.password, "Password")} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="vp-label">URL</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: entry.url ? "var(--accent)" : "var(--muted-foreground)" }}>
              {entry.url || "\u2014"}
            </span>
            {entry.url && (
              <>
                <button
                  onClick={() => browser.tabs.create({ url: entry.url })}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--muted-foreground)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  Open
                </button>
                <CopyButton onClick={() => copyToClipboard(entry.url, "URL")} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: 8,
        color: "var(--muted-foreground)",
        fontSize: 11,
        padding: "4px 10px",
        cursor: "pointer",
        fontFamily: "inherit",
        flexShrink: 0,
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      Copy
    </button>
  );
}
