"use client";

import type { Entry } from "@/types/entries";

type EntryDetailsProps = {
  entry: Entry;
  showPassword: boolean;
  onTogglePassword: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: (text: string, label: string, entryId: Entry["id"]) => void;
  formatLastCopied: (value: string | null) => string;
};

export default function EntryDetails({
  entry,
  showPassword,
  onTogglePassword,
  onEdit,
  onDelete,
  onCopy,
  formatLastCopied,
}: EntryDetailsProps) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
            Entry
          </p>
          <h2 className="text-3xl font-semibold">{entry.name}</h2>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            {entry.url || "No link"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onEdit}
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--accent)]"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="rounded-full border border-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-[color:var(--danger)] transition hover:brightness-95"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--border)] p-4">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
            Link
          </label>
          <div className="mt-3 flex items-center justify-between gap-3">
            {entry.url ? (
              <a
                href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-semibold text-[color:var(--link)]"
              >
                {entry.url}
              </a>
            ) : (
              <span className="text-sm text-[color:var(--muted-foreground)]">
                No link
              </span>
            )}
            <button
              onClick={() => onCopy(entry.url, "Link", entry.id)}
              className="rounded-full border border-[color:var(--border)] p-2 transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              title="Copy"
              disabled={!entry.url}
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
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--border)] p-4">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
            Username
          </label>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold">
              {entry.username || "No username"}
            </span>
            <button
              onClick={() => onCopy(entry.username, "Username", entry.id)}
              className="rounded-full border border-[color:var(--border)] p-2 transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              title="Copy"
              disabled={!entry.username}
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
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--border)] p-4 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
            Password
          </label>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="truncate font-mono text-sm">
              {showPassword ? entry.password : "••••••••••••••••"}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onTogglePassword}
                className="rounded-full border border-[color:var(--border)] p-2 transition hover:border-[color:var(--accent)]"
                title={showPassword ? "Hide" : "Show"}
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
                onClick={() => onCopy(entry.password, "Password", entry.id)}
                className="rounded-full border border-[color:var(--border)] p-2 transition hover:border-[color:var(--accent)]"
                title="Copy"
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
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:col-span-2">
          <div className="rounded-xl border border-[color:var(--border)] p-4">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
              Last copied
            </label>
            <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
              {formatLastCopied(entry.last_copied)}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] p-4">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">
              Created
            </label>
            <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
              {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Unknown"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
